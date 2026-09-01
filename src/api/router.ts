import express from 'express';
import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import {
  emailDepositSubmitted, emailDepositApproved, emailDepositRejected,
  emailWithdrawalSubmitted, emailWithdrawalApproved, emailWithdrawalRejected,
  emailWithdrawalOtp, emailAgentWithdrawalConfirmed, emailAffiliateCommission,
  emailPurchase, emailAffiliateWithdrawalSubmitted,
  emailAffiliateWithdrawalApproved, emailAffiliateWithdrawalRejected,
  emailFormationPurchase,
  emailAgentNewRequest, emailAgentProcessed,
  emailServiceCredentials,
  send2FAOtp,
  sendTextEmail,
  ADMIN_EMAIL,
} from '../lib/email.ts';
import { getEventBus } from './realtime.ts';
import { createPlopPlopPayment, verifyPlopPlopPayment, PLOPPLOP_METHODS, type PlopPlopMethod } from './plopplop.ts';
import {
  extractCard,
  extractCardList,
  extractCustomer,
  getHeyQOEnvironment,
  heyqoRequest,
  HeyQOError,
  isHeyQOConfigured,
  sanitizeHeyQOCard,
  unwrapHeyQO,
  webhookDigest,
} from './heyqo.ts';
import {
  aiRateLimiter,
  authRateLimiter,
  financialRateLimiter,
  idempotencyGuard,
  sseRateLimiter,
  twoFactorRateLimiter,
} from './rateLimit.ts';

const _require = createRequire(import.meta.url);
let webpush: typeof import('web-push') | null = null;
try {
  webpush = _require('web-push');
} catch (e) {
  console.warn('[Push] web-push module unavailable:', e);
}

// ─── Firebase Admin ────────────────────────────────────────────────────────────
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB_ID || 'ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2';

let adminApp: App;
let adminDb: ReturnType<typeof getFirestore>;
let _initError: string | null = null;
let _initAttempted = false;

function parseServiceAccount(raw: string): any {
  let json = raw.trim();
  // Support base64-encoded JSON (common Vercel workaround)
  if (!json.startsWith('{')) {
    try {
      const decoded = Buffer.from(json, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) json = decoded;
    } catch {}
  }
  // Re-check after potential base64 decode
  if (!json.startsWith('{')) json = '{' + json;
  const sa = JSON.parse(json);
  if (sa.private_key) {
    // Normalize private key: replace any escaped newline variants with real newlines
    // Handles: \\n (double-escaped), \n (single-escaped literal string)
    let key: string = sa.private_key;
    // Keep replacing until stable (handles multiple layers of escaping)
    let prev = '';
    while (prev !== key) {
      prev = key;
      key = key.replace(/\\n/g, '\n');
    }
    // If key still has no real newlines (i.e. it came in as a single line), try splitting on \n literal
    if (!key.includes('\n')) {
      key = key.split('\\n').join('\n');
    }
    // Normalize non-standard PEM headers to standard English ones that OpenSSL expects.
    // Firebase service accounts downloaded in some locales use translated headers.
    key = key
      .replace(/-----[^-]*BEGIN[^-]*PRIVAT[^-]*-----/i, '-----BEGIN PRIVATE KEY-----')
      .replace(/-----[^-]*END[^-]*PRIVAT[^-]*-----/i, '-----END PRIVATE KEY-----')
      .replace(/-----DEBUT PRIV[^-]*-----/i, '-----BEGIN PRIVATE KEY-----')
      .replace(/-----END CL[^-]*PRIV[^-]*-----/i, '-----END PRIVATE KEY-----')
      .replace(/-----FIN CL[^-]*PRIV[^-]*-----/i, '-----END PRIVATE KEY-----');
    sa.private_key = key;
  }
  return sa;
}

function initFirebaseAdmin() {
  _initAttempted = true;
  try {
    if (getApps().length > 0) {
      adminApp = getApps()[0];
    } else {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!raw) {
        _initError = 'FIREBASE_SERVICE_ACCOUNT non défini';
        console.error('[Admin] FIREBASE_SERVICE_ACCOUNT not set — admin routes disabled');
        return;
      }
      const serviceAccount = parseServiceAccount(raw);
      adminApp = initializeApp({ credential: cert(serviceAccount) });
    }
    adminDb = getFirestore(adminApp, FIRESTORE_DB_ID);
    _initError = null;
    console.log('[Admin] Firebase Admin SDK initialized');
  } catch (e: any) {
    _initError = e?.message || String(e);
    console.error('[Admin] Initialization failed:', e);
  }
}

initFirebaseAdmin();

// ─── FCM Admin Messaging ──────────────────────────────────────────────────────
let _fcmMessaging: ReturnType<typeof getAdminMessaging> | null = null;

function getFcmMessaging(): ReturnType<typeof getAdminMessaging> | null {
  if (_fcmMessaging) return _fcmMessaging;
  if (!adminApp) return null;
  try {
    _fcmMessaging = getAdminMessaging(adminApp);
    return _fcmMessaging;
  } catch (e) {
    console.warn('[FCM] Admin Messaging init failed:', e);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function serializeDoc(snap: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot): any {
  const data = snap.data() || {};
  const result: any = { id: snap.id };
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
      result[key] = { _seconds: (value as any).seconds, _nanoseconds: (value as any).nanoseconds };
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── 2FA OTP helpers ──────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return local[0] + '*'.repeat(Math.max(1, local.length - 1)) + '@' + domain;
  return local[0] + '*'.repeat(local.length - 2) + local[local.length - 1] + '@' + domain;
}

async function create2FASession(opts: {
  role: string;
  accountId: string;
  email: string;
  name: string;
  extra?: Record<string, any>;
}): Promise<{ sessionId: string; otpPlain: string }> {
  const otpPlain = String(randomInt(100000, 999999));
  const otpHash = createHash('sha256').update(otpPlain).digest('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min TTL

  const ref = await adminDb.collection('otp_sessions').add({
    role: opts.role,
    accountId: opts.accountId,
    email: opts.email,
    name: opts.name,
    otpHash,
    attempts: 0,
    expiresAt,
    extra: opts.extra || {},
    createdAt: FieldValue.serverTimestamp(),
  });

  return { sessionId: ref.id, otpPlain };
}

async function verify2FASession(
  sessionId: string,
  code: string,
  expectedRole?: string,
): Promise<{ ok: boolean; error?: string; accountId?: string; role?: string; name?: string; email?: string; extra?: any }> {
  const ref = adminDb.collection('otp_sessions').doc(sessionId);
  const snap = await ref.get();

  if (!snap.exists) return { ok: false, error: 'Session invalide ou expirée. Veuillez vous reconnecter.' };

  const d = snap.data()!;
  if (expectedRole && d.role !== expectedRole) return { ok: false, error: 'Session invalide.' };

  const expiresAt = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
  if (expiresAt < new Date()) {
    await ref.delete().catch(() => {});
    return { ok: false, error: 'Code expiré. Veuillez vous reconnecter.' };
  }

  const attempts = d.attempts || 0;
  if (attempts >= 5) {
    await ref.delete().catch(() => {});
    return { ok: false, error: 'Trop de tentatives. Veuillez vous reconnecter.' };
  }

  const inputHash = createHash('sha256').update(code.trim()).digest('hex');
  if (inputHash !== d.otpHash) {
    await ref.update({ attempts: FieldValue.increment(1) });
    const remaining = 4 - attempts;
    return {
      ok: false,
      error: `Code incorrect. ${remaining} tentative${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`,
    };
  }

  await ref.delete().catch(() => {});
  return { ok: true, accountId: d.accountId, role: d.role, name: d.name, email: d.email, extra: d.extra };
}

// ── PIN security helpers ──────────────────────────────────────────────────────
function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pin, salt, 32).toString('hex');
  return `${salt}$${hash}`;
}

function verifyPin(pin: string, stored: string): boolean {
  try {
    const [salt, storedHash] = stored.split('$');
    if (!salt || !storedHash) return false;
    const hash = scryptSync(pin, salt, 32);
    return timingSafeEqual(Buffer.from(storedHash, 'hex'), hash);
  } catch {
    return false;
  }
}

// ── Password and server session helpers ───────────────────────────────────────
// Password hashes use the same memory-hard primitive as PINs. Existing plaintext
// passwords are upgraded only after a successful login, never returned to callers.
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: unknown): boolean {
  if (typeof stored !== 'string' || !stored) return false;
  if (!stored.startsWith('scrypt$')) {
    const expected = Buffer.from(stored);
    const supplied = Buffer.from(password);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
  try {
    const [, salt, storedHash] = stored.split('$');
    const hash = scryptSync(password, salt, 64);
    const expected = Buffer.from(storedHash, 'hex');
    return expected.length === hash.length && timingSafeEqual(expected, hash);
  } catch {
    return false;
  }
}

type AdminSession = { role: 'admin'; adminId: string; exp: number };
type ClientSession = { role: 'client'; clientId: string; exp: number };
type AgentSession = { role: 'agent'; agentId: string; exp: number };
type AffiliateSession = { role: 'affiliate'; affiliateId: string; exp: number };

function sessionSecret(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 32 ? Buffer.from(secret) : null;
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator > 0) {
      const key = item.slice(0, separator).trim();
      cookies[key] = decodeURIComponent(item.slice(separator + 1).trim());
    }
    return cookies;
  }, {});
}

function signSession(payload: string, secret: Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function readAdminSession(req: express.Request): AdminSession | null {
  const secret = sessionSecret();
  const token = parseCookies(req.headers.cookie).rena_admin_session;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSession(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession;
    if (session.role !== 'admin' || !session.adminId || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setAdminSession(res: express.Response, adminId: string): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET doit être configuré pour ouvrir une session administrateur.');
  const session: AdminSession = { role: 'admin', adminId, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.cookie('rena_admin_session', `${payload}.${signSession(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function readClientSession(req: express.Request): ClientSession | null {
  const secret = sessionSecret();
  const token = parseCookies(req.headers.cookie).rena_client_session;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSession(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ClientSession;
    if (session.role !== 'client' || !session.clientId || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setClientSession(res: express.Response, clientId: string): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET doit être configuré pour ouvrir une session client.');
  const session: ClientSession = { role: 'client', clientId, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.cookie('rena_client_session', `${payload}.${signSession(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function readAgentSession(req: express.Request): AgentSession | null {
  const secret = sessionSecret();
  const token = parseCookies(req.headers.cookie).rena_agent_session;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSession(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AgentSession;
    if (session.role !== 'agent' || !session.agentId || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setAgentSession(res: express.Response, agentId: string): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET doit être configuré pour ouvrir une session agent.');
  const session: AgentSession = { role: 'agent', agentId, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.cookie('rena_agent_session', `${payload}.${signSession(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function readAffiliateSession(req: express.Request): AffiliateSession | null {
  const secret = sessionSecret();
  const token = parseCookies(req.headers.cookie).rena_affiliate_session;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSession(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AffiliateSession;
    if (session.role !== 'affiliate' || !session.affiliateId || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setAffiliateSession(res: express.Response, affiliateId: string): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET doit être configuré pour ouvrir une session affilié.');
  const session: AffiliateSession = { role: 'affiliate', affiliateId, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.cookie('rena_affiliate_session', `${payload}.${signSession(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

type TeacherSession = { role: 'teacher'; teacherId: string; exp: number };

function readTeacherSession(req: express.Request): TeacherSession | null {
  const secret = sessionSecret();
  const token = parseCookies(req.headers.cookie).rena_teacher_session;
  if (!secret || !token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = signSession(payload, secret);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TeacherSession;
    if (session.role !== 'teacher' || !session.teacherId || !Number.isFinite(session.exp) || session.exp <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function setTeacherSession(res: express.Response, teacherId: string): void {
  const secret = sessionSecret();
  if (!secret) throw new Error('SESSION_SECRET doit être configuré pour ouvrir une session professeur.');
  const session: TeacherSession = { role: 'teacher', teacherId, exp: Date.now() + 8 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  res.cookie('rena_teacher_session', `${payload}.${signSession(payload, secret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

async function issueAdminFirebaseToken(adminRef: any, data: any): Promise<string> {
  const auth = getAuth();
  let uid = data.uid as string | undefined;
  if (!uid) {
    if (data.email) {
      try {
        uid = (await auth.getUserByEmail(data.email)).uid;
      } catch {
        uid = (await auth.createUser({ email: data.email, displayName: data.fullName || 'Administrateur' })).uid;
      }
    } else {
      uid = (await auth.createUser({ displayName: data.fullName || 'Administrateur' })).uid;
    }
    await adminRef.update({ uid, updatedAt: FieldValue.serverTimestamp() });
  }
  await auth.setCustomUserClaims(uid, { admin: true });
  return auth.createCustomToken(uid, { admin: true });
}

async function requireAdminSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = readAdminSession(req);
  if (!session) return res.status(401).json({ error: 'Session administrateur requise. Veuillez vous reconnecter.' });
  try {
    const admin = await adminDb.collection('admin_accounts').doc(session.adminId).get();
    if (!admin.exists || admin.data()?.disabled === true) {
      res.clearCookie('rena_admin_session', { path: '/' });
      return res.status(403).json({ error: 'Compte administrateur indisponible.' });
    }
    res.locals.adminSession = session;
    res.locals.adminRecord = admin.data();
    next();
  } catch {
    return res.status(503).json({ error: 'Vérification de session temporairement indisponible.' });
  }
}

function sanitizeFormation(data: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item: any) =>
        item && typeof item === 'object' ? sanitizeFormation(item) : (item ?? null)
      );
    } else {
      out[k] = v ?? null;
    }
  }
  return out;
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) { console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not set — skipping'); return true; }
  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}`,
    });
    const data: any = await resp.json();
    return data.success === true;
  } catch (e) {
    console.error('[reCAPTCHA] verification error:', e);
    return false;
  }
}

function sendAdminEmail(subject: string, text: string): void {
  void sendTextEmail(ADMIN_EMAIL, subject, text, 'admin_notification');
}

// ── Resend email + Firestore audit log (fire-and-forget) ─────────────────────
function fireEmail(
  fn: () => Promise<void>,
  meta: { type: string; to: string | string[]; clientId?: string; amount?: number }
): void {
  fn().then(() => {
    if (!adminDb) return;
    adminDb.collection('email_logs').add({
      ...meta,
      status: 'sent',
      sentAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
  }).catch((e: any) => {
    console.error(`[Email] fireEmail error (${meta.type}):`, e?.message || e);
    if (!adminDb) return;
    adminDb.collection('email_logs').add({
      ...meta,
      status: 'failed',
      error: e?.message || String(e),
      sentAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
  });
}

// ─── FCM: send push to a client by clientId (fire-and-forget) ────────────────
async function sendFcmToClient(
  clientId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const fm = getFcmMessaging();
  if (!fm || !adminDb) return;
  try {
    const tokenSnap = await adminDb.collection('fcm_tokens').doc(clientId).get();
    if (!tokenSnap.exists) return;
    const token: string = tokenSnap.data()!.token;
    if (!token) return;
    await fm.send({
      token,
      notification: { title, body },
      data: data || {},
      webpush: {
        notification: {
          title,
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
      },
    });
  } catch (e: any) {
    const code: string = e?.errorInfo?.code || e?.code || '';
    if (
      code.includes('registration-token-not-registered') ||
      code.includes('invalid-registration-token')
    ) {
      try { await adminDb.collection('fcm_tokens').doc(clientId).delete(); } catch {}
    }
    console.warn('[FCM] sendFcmToClient error:', e?.message || e);
  }
}

// ─── Guards ───────────────────────────────────────────────────────────────────

const requireDb = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!adminDb) initFirebaseAdmin();
  if (!adminDb) {
    const detail = _initError ? ` Erreur: ${_initError}` : '';
    return res.status(503).json({ error: `Firebase Admin non initialisé.${detail}` });
  }
  next();
};

async function requireClientSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (res.locals.clientSession && res.locals.clientRecord) return next();
  const session = readClientSession(req);
  if (!session) return res.status(401).json({ error: 'Session client requise. Veuillez vous reconnecter.' });
  try {
    const client = await adminDb.collection('clients').doc(session.clientId).get();
    if (!client.exists || client.data()?.status === 'blocked') {
      res.clearCookie('rena_client_session', { path: '/' });
      return res.status(403).json({ error: 'Compte client indisponible.' });
    }
    res.locals.clientSession = session;
    res.locals.clientRecord = client;
    next();
  } catch {
    return res.status(503).json({ error: 'Vérification de session temporairement indisponible.' });
  }
}

async function requireAgentSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (res.locals.agentSession && res.locals.agentRecord) return next();
  const session = readAgentSession(req);
  if (!session) return res.status(401).json({ error: 'Session agent requise. Veuillez vous reconnecter.' });
  try {
    const agent = await adminDb.collection('agents').doc(session.agentId).get();
    if (!agent.exists || agent.data()?.status === 'inactive') {
      res.clearCookie('rena_agent_session', { path: '/' });
      return res.status(403).json({ error: 'Compte agent indisponible.' });
    }
    const data = agent.data()!;
    const suppliedAgentId = req.body?.agentId || req.query?.agentId;
    const suppliedAgentCode = req.body?.agentCode || req.query?.agentCode;
    if ((suppliedAgentId && suppliedAgentId !== session.agentId) ||
        (suppliedAgentCode && suppliedAgentCode !== data.agentCode)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    res.locals.agentSession = session;
    res.locals.agentRecord = agent;
    next();
  } catch {
    return res.status(503).json({ error: 'Vérification de session temporairement indisponible.' });
  }
}

async function requireAffiliateSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (res.locals.affiliateSession && res.locals.affiliateRecord) return next();
  const session = readAffiliateSession(req);
  if (!session) return res.status(401).json({ error: 'Session affilié requise. Veuillez vous reconnecter.' });
  try {
    const affiliate = await adminDb.collection('affiliates').doc(session.affiliateId).get();
    if (!affiliate.exists || affiliate.data()?.disabled === true || affiliate.data()?.status === 'inactive') {
      res.clearCookie('rena_affiliate_session', { path: '/' });
      return res.status(403).json({ error: 'Compte affilié indisponible.' });
    }
    const suppliedAffiliateId = req.body?.affiliateId || req.query?.affiliateId;
    if (suppliedAffiliateId && suppliedAffiliateId !== session.affiliateId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    res.locals.affiliateSession = session;
    res.locals.affiliateRecord = affiliate;
    next();
  } catch {
    return res.status(503).json({ error: 'Vérification de session temporairement indisponible.' });
  }
}

async function requireTeacherSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = readTeacherSession(req);
  if (!session) return res.status(401).json({ error: 'Session professeur requise. Veuillez vous reconnecter.' });
  try {
    const teacher = await adminDb.collection('teachers').doc(session.teacherId).get();
    if (!teacher.exists || teacher.data()?.status === 'inactive') {
      res.clearCookie('rena_teacher_session', { path: '/' });
      return res.status(403).json({ error: 'Compte professeur indisponible.' });
    }
    res.locals.teacherSession = session;
    res.locals.teacherRecord = teacher;
    next();
  } catch {
    return res.status(503).json({ error: 'Vérification de session temporairement indisponible.' });
  }
}

const blockNewCryptoClientOrders = (_req: express.Request, res: express.Response, _next: express.NextFunction) =>
  res.status(503).json({
    error: 'Le service crypto est bientôt disponible. Les nouvelles commandes sont temporairement fermées.',
  });

// Backwards-compatible route middleware name. The old shared browser secret has
// been replaced by a signed, HttpOnly server session.
const requireAdminSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  return requireAdminSession(req, res, next);
};

function requireAdminPermission(permission: string) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    const admin = res.locals.adminRecord;
    if (!admin) return res.status(401).json({ error: 'Session administrateur requise.' });
    if (admin.isSuperAdmin === true || (Array.isArray(admin.permissions) && admin.permissions.includes(permission))) return next();
    return res.status(403).json({ error: 'Permission administrateur insuffisante pour le marché crypto.' });
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

const router = express.Router();

async function transitionPending(
  ref: FirebaseFirestore.DocumentReference,
  updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
): Promise<void> {
  await adminDb.runTransaction(async (txn) => {
    const snapshot = await txn.get(ref);
    if (!snapshot.exists || snapshot.data()!.status !== 'pending') {
      throw new Error('Cette demande a déjà été traitée.');
    }
    txn.update(ref, updates);
  });
}

// Every admin endpoint is protected consistently. Only the two login phases and
// first-time Google account linking are public; all other routes fail closed.
const publicAdminPaths = new Set([
  '/login',
  '/verify-2fa',
  '/verify-google',
  '/link-google',
]);
router.use('/api/admin', requireDb, (req, res, next) => {
  if (publicAdminPaths.has(req.path)) return next();
  return requireAdminSession(req, res, next);
});

const publicClientPaths = new Set([
  '/fees',
  '/register',
  '/login',
  '/login-google',
  '/register-google',
  '/logout',
]);
router.use('/api/client', requireDb, (req, res, next) => {
  if (publicClientPaths.has(req.path)) return next();
  return requireClientSession(req, res, () => {
    const sessionId = res.locals.clientSession.clientId as string;
    const suppliedIds = [req.body?.clientId, req.body?.senderClientId, req.query?.clientId];
    if (suppliedIds.some((id) => id && id !== sessionId)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    const clientPathMatch = req.path.match(/^\/(?:transactions|pending-confirmations|notifications\/read-all|notifications\/clear-all)\/([^/]+)$/);
    if (clientPathMatch && clientPathMatch[1] !== sessionId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    if (req.body && typeof req.body === 'object') {
      const client = res.locals.clientRecord.data() || {};
      if ('clientId' in req.body) req.body.clientId = sessionId;
      if ('senderClientId' in req.body) req.body.senderClientId = sessionId;
      if ('clientName' in req.body) req.body.clientName = client.name || '';
      if ('clientPhone' in req.body) req.body.clientPhone = client.phone || '';
      if ('clientWalletId' in req.body) req.body.clientWalletId = client.walletId || '';
    }
    next();
  });
});

const publicAgentPaths = new Set(['/lookup', '/link-uid', '/verify-2fa', '/logout']);
router.use('/api/agent', requireDb, (req, res, next) => {
  if (publicAgentPaths.has(req.path)) return next();
  return requireAgentSession(req, res, () => {
    const agentId = res.locals.agentSession.agentId as string;
    const agentCode = res.locals.agentRecord.data()?.agentCode as string;
    const idMatch = req.path.match(/^\/(?:events|personal-transactions|fee-records|client-deposit-requests)\/([^/]+)$/)
      || req.path.match(/^\/([^/]+)\/photo$/);
    const codeMatch = req.path.match(/^\/(?:has-pin|pending-withdrawals|withdrawal-requests|transactions|stats)\/([^/]+)$/);
    if ((idMatch && idMatch[1] !== agentId) || (codeMatch && codeMatch[1] !== agentCode)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    next();
  });
});

const publicAffiliatePaths = new Set(['/login', '/google-login', '/verify-2fa', '/logout']);
router.use('/api/affiliate', requireDb, (req, res, next) => {
  if (publicAffiliatePaths.has(req.path)) return next();
  return requireAffiliateSession(req, res, () => {
    const affiliateId = res.locals.affiliateSession.affiliateId as string;
    const idMatch = req.path.match(/^\/(?:events|has-pin|client-withdrawal-requests|client-deposit-requests|notifications|notifications\/read-all|notifications\/clear-all)\/([^/]+)$/)
      || req.path.match(/^\/([^/]+)\/photo$/);
    if (idMatch && idMatch[1] !== affiliateId) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    next();
  });
});

// Route profiles run after the role guards above, so financial and AI limits
// use both the source IP and the verified signed session identity.
for (const path of [
  '/api/client/login',
  '/api/client/login-google',
  '/api/client/register',
  '/api/client/register-google',
  '/api/agent/link-uid',
  '/api/affiliate/login',
  '/api/affiliate/google-login',
  '/api/admin/login',
  '/api/admin/verify-google',
  '/api/admin/link-google',
  '/api/teacher/login',
  '/api/teacher/verify-google',
]) router.use(path, authRateLimiter);
for (const path of [
  '/api/auth/resend-2fa',
  '/api/agent/verify-2fa',
  '/api/affiliate/verify-2fa',
  '/api/admin/verify-2fa',
]) router.use(path, twoFactorRateLimiter);
for (const path of [
  '/api/client/deposit', '/api/client/withdrawal', '/api/client/transfer',
  '/api/client/purchase', '/api/client/agent-withdrawal', '/api/client/agent-deposit',
  '/api/client/agent-deposit-request', '/api/client/generate-tx-code',
  '/api/agent/client-transaction', '/api/agent/initiate-withdrawal',
  '/api/agent/personal-deposit', '/api/agent/personal-withdrawal',
  '/api/agent/self-deposit-request', '/api/affiliate/client-direct-tx',
  '/api/affiliate/submit-client-deposit', '/api/affiliate/submit-deposit',
  '/api/affiliate/submit-withdrawal',
  '/api/client/confirm-withdrawal', '/api/client/reject-withdrawal',
  '/api/agent/cancel-withdrawal', '/api/agent/withdrawal-request',
  '/api/agent/client-deposit', '/api/affiliate/client-withdrawal',
  '/api/affiliate/client-deposit',
  '/api/admin/agent-personal-deposit', '/api/admin/agent-personal-withdrawal',
  '/api/admin/purchase/approve', '/api/admin/withdrawal',
  '/api/admin/fees/withdraw', '/api/admin/teacher-transactions',
  '/api/admin/agent',
  '/api/admin/affiliate', '/api/admin/profit',
  '/api/admin/purchase/decline', '/api/admin/transaction/status',
  '/api/admin/formations/purchases', '/api/admin/formations/payment-requests',
  '/api/admin/teacher-withdrawals', '/api/admin/card-topup',
  '/api/formations/purchases', '/api/formations/payment-request',
  '/api/client/crypto-orders', '/api/client/crypto-market/requests',
  '/api/client/cards',
  '/api/teacher/withdrawal', '/api/crypto/create-payment',
  '/api/fazer/topups/order', '/api/fazer/giftcards/order',
  '/api/reseller/ff/order', '/api/reseller/ff/buy-pack',
]) router.use(path, financialRateLimiter, idempotencyGuard());
router.use('/api/agent/ai-chat', aiRateLimiter);
router.use('/api/client/events', sseRateLimiter);
router.use('/api/agent/events', sseRateLimiter);
router.use('/api/affiliate/events', sseRateLimiter);

// ── SSE: realtime event bus ────────────────────────────────────────────────────
// Broadcasts go through the shared event bus (Redis pub/sub when REDIS_URL is
// set, in-memory otherwise) so notifications reach connected clients even when
// the publishing request and the open SSE connection land on different
// serverless instances (e.g. on Vercel). See src/api/realtime.ts.
const eventBus = getEventBus();

function sseChannelForClient(clientId: string): string {
  return `sse:client:${clientId}`;
}

function pushClientEvent(clientId: string, event: string, data: object): void {
  eventBus.publish(sseChannelForClient(clientId), JSON.stringify({ event, data }));
}

// ── SSE: Multi-role real-time connections (affiliate, agent, teacher, admin) ──
type SseRole = 'affiliate' | 'agent' | 'teacher' | 'admin';
const ADMIN_BROADCAST_CHANNEL = 'sse:role:admin:__all__';

function sseChannelForRole(role: SseRole, userId: string): string {
  return `sse:role:${role}:${userId}`;
}

function pushRoleEvent(role: SseRole, userId: string, event: string, data: object): void {
  eventBus.publish(sseChannelForRole(role, userId), JSON.stringify({ event, data }));
}

function pushAllAdminsEvent(event: string, data: object): void {
  eventBus.publish(ADMIN_BROADCAST_CHANNEL, JSON.stringify({ event, data }));
}

// Writes SSE headers, subscribes `res` to one or more bus channels for the
// lifetime of the HTTP connection, and forwards published events to the client.
function attachSseStream(res: express.Response, req: express.Request, channels: string[]): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(': connected\n\n');

  const unsubscribers = channels.map((channel) =>
    eventBus.subscribe(channel, (message) => {
      try {
        const { event, data } = JSON.parse(message);
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (e) {
        console.error('[SSE] Failed to forward event:', e);
      }
    })
  );

  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    for (const unsubscribe of unsubscribers) unsubscribe();
  });
}

function makeSseHandler(role: SseRole, paramName: string) {
  return (req: express.Request, res: express.Response) => {
    const userId = req.params[paramName];
    if (!userId) { res.status(400).end(); return; }
    const channels = [sseChannelForRole(role, userId)];
    if (role === 'admin') channels.push(ADMIN_BROADCAST_CHANNEL);
    attachSseStream(res, req, channels);
  };
}

// Ensures the requested `:paramName` in the URL matches the id carried by the
// caller's own session, so an authenticated user cannot open another user's
// event stream by guessing/passing a different id.
function requireOwnSseId(paramName: string, getSessionId: (res: express.Response) => string | undefined) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const expected = getSessionId(res);
    if (!expected || req.params[paramName] !== expected) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    next();
  };
}

// ── FCM: send notification to any role's user ─────────────────────────────────
async function sendFcmToRole(
  role: string, userId: string,
  title: string, body: string,
  data?: Record<string, string>
): Promise<void> {
  const fm = getFcmMessaging();
  if (!fm || !adminDb) return;
  try {
    const docId = role === 'client' ? userId : `${role}_${userId}`;
    const tokenSnap = await adminDb.collection('fcm_tokens').doc(docId).get();
    if (!tokenSnap.exists) return;
    const token: string = tokenSnap.data()!.token;
    if (!token) return;
    await fm.send({
      token,
      notification: { title, body },
      data: data || {},
      webpush: {
        notification: {
          title, body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          vibrate: [200, 100, 200],
          requireInteraction: false,
        },
      },
    });
  } catch (e: any) {
    const code: string = e?.errorInfo?.code || e?.code || '';
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      const docId = role === 'client' ? userId : `${role}_${userId}`;
      try { await adminDb.collection('fcm_tokens').doc(docId).delete(); } catch {}
    }
    console.warn(`[FCM] sendFcmToRole(${role},${userId}):`, e?.message || e);
  }
}

// ── Public: fee preview (no auth – preview only, server calculates authoritatively) ──
router.get('/api/client/fees', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('global').get();
    const s = snap.data() || {};
    res.json({
      depositFeePercent:              Number(s.depositFeePercent              || 0),
      withdrawalFeePercent:           Number(s.withdrawalFeePercent           || 0),
      agentDepositCommissionPercent:  Number(s.agentDepositCommissionPercent  || 0),
      agentWithdrawPercent:           Number(s.agentWithdrawPercent           || 0),
      agentWithdrawAgentSharePercent: Number(s.agentWithdrawAgentSharePercent ?? 100),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Role SSE endpoints ────────────────────────────────────────────────────────
router.get('/api/affiliate/events/:affiliateId', makeSseHandler('affiliate', 'affiliateId'));
router.get('/api/agent/events/:agentId',         makeSseHandler('agent',     'agentId'));

router.get(
  '/api/teacher/events/:teacherId',
  requireTeacherSession,
  requireOwnSseId('teacherId', (res) => res.locals.teacherSession?.teacherId),
  makeSseHandler('teacher', 'teacherId')
);

// requireAdminSession already runs for every /api/admin/* path via the
// router.use('/api/admin', ...) guard registered above; this only adds the
// per-admin ownership check so one admin can't read another admin's channel.
router.get(
  '/api/admin/events/:adminId',
  requireOwnSseId('adminId', (res) => res.locals.adminSession?.adminId),
  makeSseHandler('admin', 'adminId')
);

// ── Client: SSE event stream (withdrawal confirmations, etc.) ─────────────────
router.get(
  '/api/client/events/:clientId',
  requireClientSession,
  requireOwnSseId('clientId', (res) => res.locals.clientSession?.clientId),
  (req, res) => {
    attachSseStream(res, req, [sseChannelForClient(req.params.clientId)]);
  }
);

// ── Health ───────────────────────────────────────────────────────────────────
router.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Debug (diagnostic Vercel — réservé aux sessions administrateur) ───────────
router.get('/api/debug', requireDb, requireAdminSession, async (req, res) => {

  // Extract project_id from service account (non-sensitive)
  let serviceAccountProjectId: string | null = null;
  let serviceAccountClientEmail: string | null = null;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    const sa = parseServiceAccount(raw);
    serviceAccountProjectId = sa.project_id || null;
    serviceAccountClientEmail = sa.client_email ? sa.client_email.split('@')[0] + '@...' : null;
  } catch {}

  // Live Firestore connectivity test
  let firestoreTest: { ok: boolean; error?: string; collections?: string[] } = { ok: false };
  if (adminDb) {
    try {
      const snap = await adminDb.listCollections();
      firestoreTest = { ok: true, collections: snap.map((c: any) => c.id) };
    } catch (e: any) {
      firestoreTest = { ok: false, error: `${e?.code} ${e?.message || String(e)}` };
    }
  }

  res.json({
    adminDbReady: !!adminDb,
    initAttempted: _initAttempted,
    initError: _initError,
    firestoreDbId: FIRESTORE_DB_ID,
    serviceAccount: { projectId: serviceAccountProjectId, clientEmail: serviceAccountClientEmail },
    firestoreTest,
    envVars: {
      FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      FIREBASE_SERVICE_ACCOUNT_length: process.env.FIREBASE_SERVICE_ACCOUNT?.length ?? 0,
      SMTP_USER: !!process.env.SMTP_USER,
      SMTP_PASS: !!process.env.SMTP_PASS,
      RECAPTCHA_SECRET_KEY: !!process.env.RECAPTCHA_SECRET_KEY,
      VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    },
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Affiliate registration email notification ─────────────────────────────────
router.post('/api/notify-registration', async (req, res) => {
  const { name, email, phone, message, date } = req.body;
  try {
    const result = await sendTextEmail(
      ADMIN_EMAIL,
      `Nouvelle demande d'inscription affilié : ${name}`,
      `Nouvelle demande d'inscription reçue !\n\nNom: ${name}\nEmail: ${email}\nTéléphone: ${phone || 'Non fourni'}\nMessage: ${message || 'Aucun message'}\nDate: ${date}\n\nConnectez-vous au tableau de bord administrateur pour approuver ou rejeter cette demande.`,
      'affiliate_registration',
    );
    if (!result.success) throw new Error(result.error || 'Resend n’a pas accepté la notification');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ── Transactions ─────────────────────────────────────────────────────────────
router.get('/api/admin/transactions', requireDb, requireAdminSecret, async (_req, res) => {
  try {
    const snap = await adminDb.collection('client_transactions').orderBy('createdAt', 'desc').limit(500).get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[GET transactions]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/client/transactions/:clientId', requireDb, requireClientSession, async (req, res) => {
  try {
    if (req.params.clientId !== res.locals.clientSession.clientId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('client_transactions')
      .where('clientId', '==', req.params.clientId)
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[GET client transactions]', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/client/transactions/:clientId', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const snap = await adminDb.collection('client_transactions')
      .where('clientId', '==', req.params.clientId).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, deleted: snap.size });
  } catch (e: any) {
    console.error('[delete transactions]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Notifications ────────────────────────────────────────────────────────────
router.get('/api/admin/notifications', requireDb, requireAdminSecret, async (_req, res) => {
  try {
    const snap = await adminDb.collection('admin_notifications').orderBy('createdAt', 'desc').limit(200).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[GET notifications]', e);
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/admin/notifications/read-all', requireDb, requireAdminSecret, async (_req, res) => {
  try {
    const snap = await adminDb.collection('admin_notifications').where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/admin/notifications/:id/read', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('admin_notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/admin/notifications/clear-all', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const snap = await adminDb.collection('admin_notifications').limit(500).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, deleted: snap.size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Client notifications ───────────────────────────────────────────────────────
router.get('/api/client/notifications/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId requis.' });
    const snap = await adminDb.collection('client_notifications')
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/client/notifications/:id/read', requireDb, async (req, res) => {
  try {
    const ref = adminDb.collection('client_notifications').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Notification introuvable.' });
    if (snap.data()?.clientId !== res.locals.clientSession.clientId) return res.status(403).json({ error: 'Accès refusé.' });
    await ref.update({ read: true });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/client/notifications/read-all/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    const snap = await adminDb.collection('client_notifications')
      .where('clientId', '==', clientId).where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/client/notifications/clear-all/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId requis.' });
    const snap = await adminDb.collection('client_notifications')
      .where('clientId', '==', clientId).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Deposit ───────────────────────────────────────────────────────────────────
router.post('/api/client/deposit', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, clientWalletId, amount, usdAmount, htgAmount, exchangeRate, method, txId, message, captchaToken, proofImageBase64 } = req.body;
    if (!clientId || !clientName || !amount || !method)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    if (amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    // Validate proof image size if provided (base64 ~4/3 of raw size; reject > 2MB decoded)
    if (proofImageBase64 && proofImageBase64.length > 2.8 * 1024 * 1024)
      return res.status(400).json({ error: 'Image trop lourde. Veuillez réduire la taille (max 2 Mo).' });
    if (captchaToken && !(await verifyRecaptcha(captchaToken)))
      return res.status(400).json({ error: 'Vérification reCAPTCHA échouée. Veuillez réessayer.' });

    // Validate min/max from settings + resolve method-specific exchange rate
    let resolvedExchangeRate = exchangeRate;
    try {
      const settingsSnap = await adminDb.collection('settings').doc('global').get();
      if (settingsSnap.exists) {
        const s = settingsSnap.data()!;
        // Use per-method rate if configured and client didn't already supply one
        if (!resolvedExchangeRate && method && s.cardRates?.[method]) {
          resolvedExchangeRate = Number(s.cardRates[method]);
        }
        if (!resolvedExchangeRate) resolvedExchangeRate = s.exchangeRate;
        const usd = usdAmount || amount;
        if (s.minDepositUSD && usd < s.minDepositUSD)
          return res.status(400).json({ error: `Montant minimum: $${s.minDepositUSD.toFixed(2)} USD` });
        if (s.maxDepositUSD && usd > s.maxDepositUSD)
          return res.status(400).json({ error: `Montant maximum: $${s.maxDepositUSD.toFixed(2)} USD` });
      }
    } catch {}

    const txRef = await adminDb.collection('client_transactions').add({
      clientId, clientName, type: 'deposit', amount, status: 'pending', method,
      ...(usdAmount !== undefined && { usdAmount }),
      ...(htgAmount !== undefined && { htgAmount }),
      ...((resolvedExchangeRate !== undefined) && { exchangeRate: resolvedExchangeRate }),
      ...(txId && { txId }),
      ...(message && { message }),
      ...(proofImageBase64 && { proofImageBase64 }),
      description: `Dépôt via ${method}${htgAmount ? ` — ${htgAmount.toLocaleString()} HTG` : ''}${message ? ` — ${message}` : ''}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const adminDepositNotif = {
      type: 'client_deposit', clientId, clientName,
      clientWalletId: clientWalletId || '', transactionId: txRef.id,
      amount, method,
      ...(usdAmount !== undefined && { usdAmount }),
      ...(htgAmount !== undefined && { htgAmount }),
      ...(exchangeRate !== undefined && { exchangeRate }),
      ...(txId && { txId }),
      ...(message && { message }),
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    const adminDepositNotifRef = await adminDb.collection('admin_notifications').add(adminDepositNotif);
    pushAllAdminsEvent('new_notification', { id: adminDepositNotifRef.id, ...adminDepositNotif, createdAt: { _seconds: Date.now() / 1000 } });

    sendAdminEmail(
      `💰 Dépôt — ${clientName}`,
      `Nouvelle demande de dépôt.\n\n` +
      `Client : ${clientName}\nWallet ID : ${clientWalletId || 'N/A'}\n` +
      `Montant USD : $${(usdAmount || amount).toFixed(2)}\n` +
      (htgAmount ? `Montant HTG : ${htgAmount.toLocaleString()} HTG\n` : '') +
      (exchangeRate ? `Taux : ${exchangeRate} HTG/USD\n` : '') +
      `Méthode : ${method}\n` +
      (txId ? `Référence : ${txId}\n` : '') +
      (message ? `Message : ${message}\n` : '')
    );

    // Resend email
    adminDb.collection('clients').doc(clientId).get().then(snap => {
      const clientEmail = snap.exists ? snap.data()?.email : undefined;
      fireEmail(
        () => emailDepositSubmitted({ clientName, clientEmail, amount: usdAmount || amount, method, txId, walletId: clientWalletId }),
        { type: 'deposit_submitted', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId, amount: usdAmount || amount }
      );
    }).catch(() => {});

    sendPushToAdmins(
      `💰 Nouveau dépôt — ${clientName}`,
      `$${(usdAmount || amount).toFixed(2)} via ${method}${htgAmount ? ` (${htgAmount.toLocaleString()} HTG)` : ''}`
    );

    sendFcmToClient(
      clientId,
      '💰 Dépôt en cours',
      `Votre demande de dépôt de $${(usdAmount || amount).toFixed(2)} a été soumise et est en attente de validation.`,
      { type: 'deposit', txId: txRef.id }
    );

    res.json({ success: true, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[deposit]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Withdrawal ────────────────────────────────────────────────────────────────
router.post('/api/client/withdrawal', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, clientPhone, clientWalletId, amount, usdAmount, htgEquivalent, exchangeRate, method, accountNumber, accountName, message, captchaToken } = req.body;
    if (!clientId || !clientName || !amount || !method || !accountNumber)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    if (amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (captchaToken && !(await verifyRecaptcha(captchaToken)))
      return res.status(400).json({ error: 'Vérification reCAPTCHA échouée. Veuillez réessayer.' });

    // Validate min/max from settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const sData = settingsSnap.exists ? settingsSnap.data()! : {};
    try {
      const usd = usdAmount || amount;
      if (sData.minWithdrawalUSD && usd < sData.minWithdrawalUSD)
        return res.status(400).json({ error: `Montant minimum: $${sData.minWithdrawalUSD.toFixed(2)} USD` });
      if (sData.maxWithdrawalUSD && usd > sData.maxWithdrawalUSD)
        return res.status(400).json({ error: `Montant maximum: $${sData.maxWithdrawalUSD.toFixed(2)} USD` });
    } catch {}

    // Anti double-withdrawal: block if pending withdrawal exists
    const pendingCheck = await adminDb.collection('client_transactions')
      .where('clientId', '==', clientId)
      .where('type', '==', 'withdrawal')
      .where('status', '==', 'pending')
      .limit(1).get();
    if (!pendingCheck.empty)
      return res.status(400).json({ error: 'Un retrait est déjà en cours de traitement. Veuillez patienter.' });

    const clientRef = adminDb.collection('clients').doc(clientId);

    // SECURITY: Use runTransaction to atomically verify balance and deduct.
    // A plain read + batch write has a race condition: two simultaneous withdrawals
    // could both pass the balance check against the same stale snapshot.
    const txRef = adminDb.collection('client_transactions').doc();
    const notifRef = adminDb.collection('admin_notifications').doc();
    let clientData: FirebaseFirestore.DocumentData;

    await adminDb.runTransaction(async (txn) => {
      const clientSnap = await txn.get(clientRef);
      if (!clientSnap.exists) throw Object.assign(new Error('Client introuvable.'), { status: 404 });
      clientData = clientSnap.data()!;
      if ((clientData.balance || 0) < amount) throw Object.assign(new Error('Solde insuffisant.'), { status: 400 });

      txn.update(clientRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(txRef, {
        clientId, clientName, type: 'withdrawal', amount, status: 'pending',
        method, accountNumber,
        ...(usdAmount !== undefined && { usdAmount }),
        ...(htgEquivalent !== undefined && { htgEquivalent }),
        ...(exchangeRate !== undefined && { exchangeRate }),
        ...(accountName && { accountName }),
        ...(message && { message }),
        description: `Retrait via ${method}${htgEquivalent ? ` — ≈ ${htgEquivalent.toLocaleString()} HTG` : ''}${message ? ` — ${message}` : ''}`,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const adminWithdrawNotifData = {
        type: 'client_withdrawal', clientId, clientName,
        clientPhone: clientPhone || '', clientWalletId: clientWalletId || '',
        transactionId: txRef.id, amount, method, accountNumber,
        ...(usdAmount !== undefined && { usdAmount }),
        ...(htgEquivalent !== undefined && { htgEquivalent }),
        ...(exchangeRate !== undefined && { exchangeRate }),
        ...(accountName && { accountName }),
        ...(message && { message }),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      };
      txn.set(notifRef, adminWithdrawNotifData);
    });
    const adminWithdrawNotif = { type: 'client_withdrawal', clientId, clientName, transactionId: txRef.id, amount, method };
    pushAllAdminsEvent('new_notification', { id: notifRef.id, ...adminWithdrawNotif, createdAt: { _seconds: Date.now() / 1000 } });

    sendAdminEmail(
      `🏧 Retrait — ${clientName}`,
      `Nouvelle demande de retrait.\n\nClient : ${clientName}\nTéléphone : ${clientPhone || 'N/A'}\n` +
      `Wallet ID : ${clientWalletId || 'N/A'}\n` +
      `Montant USD : $${(usdAmount || amount).toFixed ? (usdAmount || amount).toFixed(2) : usdAmount || amount}\n` +
      (htgEquivalent ? `≈ HTG : ${htgEquivalent.toLocaleString()} HTG\n` : '') +
      `Méthode : ${method}\nCompte : ${accountNumber}\n` +
      (accountName ? `Bénéficiaire : ${accountName}\n` : '') +
      (message ? `Message : ${message}\n` : '') +
      `\n⚠️ Solde débité. Traitez ce retrait depuis le tableau de bord.`
    );
    fireEmail(
      () => emailWithdrawalSubmitted({ clientName, clientEmail: clientData.email, amount: usdAmount || amount, method, accountNumber, accountName }),
      { type: 'withdrawal_submitted', to: [ADMIN_EMAIL, ...(clientData.email ? [clientData.email] : [])], clientId, amount: usdAmount || amount }
    );
    sendPushToAdmins(
      `🏧 Nouveau retrait — ${clientName}`,
      `$${(usdAmount || amount).toFixed ? (usdAmount || amount).toFixed(2) : usdAmount || amount} via ${method} → ${accountNumber}`
    );
    sendFcmToClient(
      clientId,
      '🏧 Retrait en cours',
      `Votre demande de retrait de $${(usdAmount || amount).toFixed ? (usdAmount || amount).toFixed(2) : usdAmount || amount} a été soumise et est en cours de traitement.`,
      { type: 'withdrawal', txId: txRef.id }
    );

    res.json({ success: true, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: search client by phone ────────────────────────────────────────────
router.get('/api/agent/client-by-phone', requireDb, async (req, res) => {
  try {
    const phone = (req.query.phone as string || '').trim();
    const agentCode = (req.query.agentCode as string || '').trim();
    if (!phone || !agentCode) return res.status(400).json({ error: 'phone et agentCode requis.' });

    // Verify agent
    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(403).json({ error: 'Code agent invalide.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(403).json({ error: 'Agent inactif.' });

    // Find client by phone
    const clientSnap = await adminDb.collection('clients').where('phone', '==', phone).limit(1).get();
    if (clientSnap.empty) return res.status(404).json({ error: 'Aucun client trouvé avec ce numéro.' });
    const clientDoc = clientSnap.docs[0];
    const clientData = clientDoc.data();
    res.json({
      found: true,
      clientId: clientDoc.id,
      name: clientData.name || '',
      phone: clientData.phone || '',
      walletId: clientData.walletId || '',
      balance: clientData.balance || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent/Affiliate: multi-field client search (phone, name, walletId) ───────
router.get('/api/agent/client-search', requireDb, async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const agentCode = (req.query.agentCode as string || '').trim();
    const affiliateId = (req.query.affiliateId as string || '').trim();
    if (!q) return res.status(400).json({ error: 'Requête de recherche manquante.' });
    if (!agentCode && !affiliateId) return res.status(400).json({ error: 'agentCode ou affiliateId requis.' });

    if (agentCode) {
      const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
      if (agentSnap.empty) return res.status(403).json({ error: 'Code agent invalide.' });
      if (agentSnap.docs[0].data().status === 'inactive') return res.status(403).json({ error: 'Agent inactif.' });
    } else {
      const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
      if (!affSnap.exists) return res.status(403).json({ error: 'Affilié introuvable.' });
    }

    const [byPhone, byWallet, byName] = await Promise.all([
      adminDb.collection('clients').where('phone', '==', q).limit(5).get(),
      adminDb.collection('clients').where('walletId', '==', q).limit(5).get(),
      adminDb.collection('clients').where('name', '>=', q).where('name', '<=', q + '\uf8ff').limit(5).get(),
    ]);

    const seen = new Set<string>();
    const results: any[] = [];
    for (const snap of [byPhone, byWallet, byName]) {
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        const d = doc.data();
        results.push({ clientId: doc.id, name: d.name || '', phone: d.phone || '', walletId: d.walletId || '', balance: d.balance || 0 });
      }
    }

    if (results.length === 0) return res.status(404).json({ error: 'Aucun client trouvé.' });
    res.json({ found: true, results, client: results[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: direct client deposit or withdrawal ────────────────────────────────
router.post('/api/agent/client-transaction', requireDb, async (req, res) => {
  try {
    const { agentCode, clientId, type, amount, note, pin } = req.body;
    if (!agentCode || !clientId || !type || !amount)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!['deposit', 'withdrawal'].includes(type))
      return res.status(400).json({ error: 'Type invalide.' });

    // Verify agent
    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(403).json({ error: 'Code agent invalide.' });
    const agentRef = agentSnap.docs[0].ref;
    const agentData = agentSnap.docs[0].data();
    if (agentData.status === 'inactive') return res.status(403).json({ error: 'Agent inactif.' });
    if (!agentData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), agentData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });

    // Get client
    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;

    // Load fee settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings = settingsSnap.data() || {};
    const agentDepositCommissionPct = Number(feeSettings.agentDepositCommissionPercent || 0);
    const agentWithdrawPct          = Number(feeSettings.agentWithdrawPercent          || 0);
    const agentWithdrawAgentSharePct = Number(feeSettings.agentWithdrawAgentSharePercent ?? 100);
    const agentDepositFeeMode  = feeSettings.agentDepositFeeMode  || 'percent';
    const agentWithdrawFeeMode = feeSettings.agentWithdrawFeeMode || 'percent';

    // Fee calculation
    let commissionAmount = 0;   // commission credited to agent (deposit)
    let totalFee = 0;           // total fee (withdrawal)
    let agentShareFee = 0;      // agent's share of withdrawal fee
    let adminShareFee = 0;      // admin's share of withdrawal fee

    if (type === 'deposit') {
      commissionAmount = agentDepositFeeMode === 'fixed'
        ? parseFloat(Number(feeSettings.agentDepositCommissionFixed || 0).toFixed(4))
        : parseFloat((usd * agentDepositCommissionPct / 100).toFixed(4));
    } else {
      totalFee = agentWithdrawFeeMode === 'fixed'
        ? parseFloat(Number(feeSettings.agentWithdrawFixed || 0).toFixed(4))
        : parseFloat((usd * agentWithdrawPct / 100).toFixed(4));
      agentShareFee = parseFloat((totalFee * agentWithdrawAgentSharePct / 100).toFixed(4));
      adminShareFee = parseFloat((totalFee - agentShareFee).toFixed(4));
    }

    // Balance checks
    if (type === 'deposit' && (agentData.balance || 0) < usd)
      return res.status(400).json({ error: 'Solde agent insuffisant pour effectuer ce dépôt.' });
    if (type === 'withdrawal' && (clientData.balance || 0) < usd)
      return res.status(400).json({ error: 'Solde client insuffisant pour ce retrait.' });

    const label = type === 'deposit' ? 'Dépôt' : 'Retrait';
    const txNote = note ? ` — ${note}` : '';
    const agentId = agentSnap.docs[0].id;

    await adminDb.runTransaction(async (txn) => {
      const [latestAgent, latestClient] = await Promise.all([
        txn.get(agentRef),
        txn.get(clientRef),
      ]);
      if (!latestAgent.exists || latestAgent.data()!.status === 'inactive') throw new Error('Agent indisponible.');
      if (!latestClient.exists) throw new Error('Client introuvable.');
      if (type === 'deposit' && Number(latestAgent.data()!.balance || 0) < usd) {
        throw new Error('Solde agent insuffisant pour effectuer ce dépôt.');
      }
      if (type === 'withdrawal' && Number(latestClient.data()!.balance || 0) < usd) {
        throw new Error('Solde client insuffisant pour ce retrait.');
      }
      if (type === 'deposit') {
        // Client receives full deposit
        txn.update(clientRef, {
          balance: FieldValue.increment(usd),
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Agent float decreases by deposit amount
        txn.update(agentRef, {
          balance: FieldValue.increment(-usd),
          commissionBalance: FieldValue.increment(commissionAmount),
          monthlyTransactions: FieldValue.increment(1), // compteur concours
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        // Client wallet debited in full
        txn.update(clientRef, {
          balance: FieldValue.increment(-usd),
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Agent: float increases by the net cash they hand to the client (usd - totalFee),
        // commission credited separately for their share of the fee.
        txn.update(agentRef, {
          balance: FieldValue.increment(usd - totalFee),
          commissionBalance: FieldValue.increment(agentShareFee),
          monthlyTransactions: FieldValue.increment(1), // compteur concours
          updatedAt: FieldValue.serverTimestamp(),
        });
        // Admin treasury gets its share of the fee
        if (adminShareFee > 0) {
          const settingsRef = adminDb.collection('settings').doc('global');
          txn.update(settingsRef, {
            feesBalance: FieldValue.increment(adminShareFee),
          });
        }
      }

      // Record in client_transactions
      const txRef = adminDb.collection('client_transactions').doc();
      txn.set(txRef, {
        clientId,
        clientName: clientData.name || '',
        type,
        amount: usd,
        status: 'approved',
        method: `Agent: ${agentData.name}`,
        agentCode,
        agentName: agentData.name || '',
        agentId,
        description: `${label} via Agent ${agentData.name}${txNote}`,
        ...(note && { message: note }),
        ...(type === 'deposit' && commissionAmount > 0 && { agentCommission: commissionAmount }),
        ...(type === 'withdrawal' && totalFee > 0 && { fee: totalFee, agentFeeShare: agentShareFee, adminFeeShare: adminShareFee }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Fee record
      if (commissionAmount > 0 || totalFee > 0) {
        const feeRef = adminDb.collection('agent_fee_records').doc();
        txn.set(feeRef, {
          agentId,
          agentCode,
          agentName: agentData.name || '',
          clientId,
          clientName: clientData.name || '',
          operationType: type,
          baseAmount: usd,
          feeTotal: type === 'deposit' ? commissionAmount : totalFee,
          agentShare: type === 'deposit' ? commissionAmount : agentShareFee,
          adminShare: type === 'deposit' ? 0 : adminShareFee,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Admin notification
      const notifRef = adminDb.collection('admin_notifications').doc();
      txn.set(notifRef, {
        type: `agent_client_${type}`,
        clientId,
        clientName: clientData.name || '',
        agentCode,
        agentName: agentData.name || '',
        amount: usd,
        ...(type === 'deposit' && commissionAmount > 0 && { agentCommission: commissionAmount }),
        ...(type === 'withdrawal' && totalFee > 0 && { fee: totalFee, agentFeeShare: agentShareFee, adminFeeShare: adminShareFee }),
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Resend email — commission agent
    if (type === 'deposit' && commissionAmount > 0 && agentData.email) {
      fireEmail(
        () => emailAffiliateCommission({ affiliateName: agentData.name || '', affiliateEmail: agentData.email, amount: commissionAmount, sourceClientName: clientData.name || '', type: 'Dépôt client' }),
        { type: 'agent_commission', to: agentData.email, amount: commissionAmount }
      );
    }

    res.json({
      success: true,
      ...(type === 'deposit' && { agentCommission: commissionAmount }),
      ...(type === 'withdrawal' && { fee: totalFee, agentShare: agentShareFee, adminShare: adminShareFee }),
    });
  } catch (e: any) {
    console.error('[agent/client-transaction]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent/Affiliate: lookup by code (client-facing, for deposit/withdrawal flows) ──
router.get('/api/agent/lookup', requireDb, async (req, res) => {
  try {
    const code = (req.query.code as string || '').trim();
    if (!code) return res.status(400).json({ error: 'code requis.' });

    // Check agents collection first
    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', code).limit(1).get();
    if (!agentSnap.empty) {
      const d = agentSnap.docs[0].data();
      return res.json({
        found: true,
        agentCode: d.agentCode,
        affiliateCode: null,
        affiliateId: null,
        name: d.name || '',
        phone: d.phone || '',
        status: d.status || 'inactive',
        available: d.status === 'active',
      });
    }

    // Fallback: check affiliates by code field
    const affSnap = await adminDb.collection('affiliates').where('code', '==', code).limit(1).get();
    if (!affSnap.empty) {
      const d = affSnap.docs[0].data();
      return res.json({
        found: true,
        agentCode: null,
        affiliateCode: code,
        affiliateId: affSnap.docs[0].id,
        name: d.name || '',
        phone: d.phone || '',
        status: 'active',
        available: true,
      });
    }

    return res.status(404).json({ error: 'Aucun agent ou affilié trouvé avec ce code.' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: link Google UID to agent document (bypasses client Firestore rules) ──────
// Called by authService.ts immediately after a successful Google sign-in.
// Security: verifies that the stored email on the agent doc matches the one
// claimed by the caller before writing the uid field.
router.post('/api/agent/link-uid', requireDb, async (req, res) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) return res.status(400).json({ error: 'Jeton Google requis.' });
    const token = await getAuth().verifyIdToken(idToken);
    const uid = token.uid;
    const email = token.email?.toLowerCase();
    if (!uid || !email || !token.email_verified) {
      return res.status(401).json({ error: 'Compte Google non vérifié.' });
    }

    // Lookup agent by email (server-side, no agentId needed from client)
    const snap = await adminDb.collection('agents').where('email', '==', email.toLowerCase()).limit(1).get();
    if (snap.empty) {
      return res.status(403).json({ error: "Aucun compte agent trouvé avec cet email." });
    }

    const agentDoc = snap.docs[0];
    const agentData = agentDoc.data();

    if (agentData.status === 'inactive') {
      return res.status(403).json({ error: 'Ce compte agent est inactif.' });
    }

    // Save uid to account
    await agentDoc.ref.update({ uid, updatedAt: FieldValue.serverTimestamp() });

    // ── 2FA: send OTP to agent email ─────────────────────────────────────────
    const agentEmail: string = agentData.email || email;
    if (!agentEmail) {
      return res.status(422).json({ error: 'Aucun email configuré sur ce compte agent.' });
    }

    const { sessionId, otpPlain } = await create2FASession({
      role: 'agent',
      accountId: agentDoc.id,
      email: agentEmail,
      name: agentData.name || '',
    });
    await send2FAOtp({ email: agentEmail, name: agentData.name || 'Agent', role: 'agent', otpCode: otpPlain, expiresMinutes: 5 });

    return res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(agentEmail) });
  } catch (e: any) {
    console.error('[Agent link-uid]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: Verify 2FA OTP ─────────────────────────────────────────────────────
router.post('/api/agent/verify-2fa', requireDb, async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) return res.status(400).json({ error: 'Paramètres manquants.' });

    const result = await verify2FASession(sessionId, code, 'agent');
    if (!result.ok) return res.status(401).json({ error: result.error });

    const agentSnap = await adminDb.collection('agents').doc(result.accountId!).get();
    if (!agentSnap.exists) return res.status(404).json({ error: 'Compte agent introuvable.' });
    if (agentSnap.data()?.status === 'inactive') return res.status(403).json({ error: 'Ce compte agent est inactif.' });

    const agent = { id: agentSnap.id, ...agentSnap.data() };
    setAgentSession(res, agentSnap.id);
    res.json({ success: true, agent });
  } catch (e: any) {
    console.error('[agent/verify-2fa]', e);
    res.status(500).json({ error: 'Erreur de vérification.' });
  }
});

router.post('/api/agent/logout', (_req, res) => {
  res.clearCookie('rena_agent_session', { path: '/' });
  res.json({ success: true });
});

// ── Client: submit agent/affiliate withdrawal request (pending, no immediate debit) ──
router.post('/api/client/agent-withdrawal', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, amount, agentCode, affiliateCode, affiliateId: bodyAffiliateId, message } = req.body;
    if (!clientId || !clientName || !amount || (!agentCode && !affiliateCode && !bodyAffiliateId))
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    let resolvedName = '';
    let resolvedAgentCode: string | null = null;
    let resolvedAgentId: string | null = null;
    let resolvedAffiliateId: string | null = null;

    if (agentCode) {
      // Legacy: lookup from agents collection
      const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
      if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
      const agentDoc = agentSnap.docs[0];
      const agentData = agentDoc.data();
      if (agentData.status === 'inactive') return res.status(400).json({ error: 'Cet agent est inactif.' });
      resolvedName = agentData.name || '';
      resolvedAgentCode = agentCode;
      resolvedAgentId = agentDoc.id;
    } else {
      // New: lookup from affiliates collection
      const code = affiliateCode || '';
      let affDoc: FirebaseFirestore.DocumentSnapshot | null = null;
      if (bodyAffiliateId) {
        const snap = await adminDb.collection('affiliates').doc(bodyAffiliateId).get();
        if (snap.exists) affDoc = snap;
      }
      if (!affDoc && code) {
        const snap = await adminDb.collection('affiliates').where('code', '==', code).limit(1).get();
        if (!snap.empty) affDoc = snap.docs[0];
      }
      if (!affDoc) return res.status(404).json({ error: 'Affilié introuvable.' });
      resolvedName = affDoc.data()!.name || '';
      resolvedAffiliateId = affDoc.id;
    }

    // Validate client & balance
    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if ((clientData.balance || 0) < usd) return res.status(400).json({ error: 'Solde client insuffisant.' });

    // Anti-double: block if pending withdrawal request already exists
    const pendingCheck = await adminDb.collection('client_transactions')
      .where('clientId', '==', clientId)
      .where('type', '==', 'withdrawal')
      .where('status', '==', 'pending')
      .where('source', '==', 'agent_withdrawal_request')
      .limit(1).get();
    if (!pendingCheck.empty)
      return res.status(400).json({ error: 'Une demande de retrait via agent est déjà en cours. Veuillez patienter.' });

    // Settings min/max
    try {
      const settingsSnap = await adminDb.collection('settings').doc('global').get();
      if (settingsSnap.exists) {
        const s = settingsSnap.data()!;
        if (s.minWithdrawalUSD && usd < s.minWithdrawalUSD)
          return res.status(400).json({ error: `Montant minimum: $${s.minWithdrawalUSD.toFixed(2)} USD` });
        if (s.maxWithdrawalUSD && usd > s.maxWithdrawalUSD)
          return res.status(400).json({ error: `Montant maximum: $${s.maxWithdrawalUSD.toFixed(2)} USD` });
      }
    } catch {}

    const batch = adminDb.batch();

    const txDocRef = adminDb.collection('client_transactions').doc();
    batch.set(txDocRef, {
      clientId,
      clientName,
      type: 'withdrawal',
      amount: usd,
      usdAmount: usd,
      status: 'pending',
      method: 'Agent',
      ...(resolvedAgentCode && { agentCode: resolvedAgentCode, agentId: resolvedAgentId }),
      ...(resolvedAffiliateId && { affiliateId: resolvedAffiliateId }),
      agentName: resolvedName,
      source: 'agent_withdrawal_request',
      description: `Retrait via Agent ${resolvedName}${message ? ` — ${message}` : ''}`,
      ...(message && { message }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.set(adminDb.collection('admin_notifications').doc(), {
      type: 'agent_withdrawal_request',
      clientId,
      clientName,
      agentName: resolvedName,
      amount: usd,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // Notify agent / affiliate of new client withdrawal request
    fireEmail(
      async () => {
        let agentEmail: string | undefined;
        if (resolvedAgentId) {
          const aSnap = await adminDb.collection('agents').doc(resolvedAgentId).get();
          agentEmail = aSnap.exists ? aSnap.data()?.email : undefined;
        } else if (resolvedAffiliateId) {
          const aSnap = await adminDb.collection('affiliates').doc(resolvedAffiliateId).get();
          agentEmail = aSnap.exists ? aSnap.data()?.email : undefined;
        }
        await emailAgentNewRequest({ agentName: resolvedName, agentEmail, clientName, type: 'withdrawal', amount: usd });
      },
      { type: 'agent_new_withdrawal_request', to: resolvedName, amount: usd },
    );

    res.json({ success: true, agentName: resolvedName, transactionId: txDocRef.id });
  } catch (e: any) {
    console.error('[client/agent-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: initiate withdrawal requiring client confirmation ──────────────────
router.post('/api/agent/initiate-withdrawal', requireDb, async (req, res) => {
  try {
    const { agentCode, clientId, amount, note } = req.body;
    if (!agentCode || !clientId || !amount) return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(403).json({ error: 'Code agent invalide.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(403).json({ error: 'Agent inactif.' });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if ((clientData.balance || 0) < usd) return res.status(400).json({ error: 'Solde client insuffisant.' });

    const pendingCheck = await adminDb.collection('agent_withdrawal_confirmations')
      .where('clientId', '==', clientId).where('status', '==', 'pending').limit(1).get();
    if (!pendingCheck.empty) return res.status(400).json({ error: 'Une demande de retrait est déjà en attente de confirmation pour ce client.' });

    // Generate 6-digit OTP + store SHA-256 hash
    const otpPlain = String(randomInt(100000, 999999));
    const otpHash = createHash('sha256').update(otpPlain).digest('hex');

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const confirmRef = adminDb.collection('agent_withdrawal_confirmations').doc();
    await confirmRef.set({
      agentId: agentDoc.id, agentCode, agentName: agentData.name || '',
      clientId, clientName: clientData.name || '',
      amount: usd, ...(note && { note }),
      status: 'pending',
      otpHash,
      otpVerified: false,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb.collection('client_notifications').add({
      clientId,
      type: 'withdrawal_confirmation_required',
      title: '⚠️ Confirmation de retrait requise',
      message: `L'agent ${agentData.name} souhaite effectuer un retrait de $${usd.toFixed(2)} depuis votre compte. Confirmez ou refusez dans votre tableau de bord.`,
      amount: usd, agentName: agentData.name || '', confirmId: confirmRef.id,
      read: false, createdAt: FieldValue.serverTimestamp(),
    });

    // Envoyer le code OTP au client par email
    if (clientData.email) {
      fireEmail(
        () => emailWithdrawalOtp({ clientName: clientData.name || '', clientEmail: clientData.email, agentName: agentData.name || '', amount: usd, otpCode: otpPlain, expiresMinutes: 30 }),
        { type: 'withdrawal_otp', to: clientData.email, clientId, amount: usd }
      );
    } else {
      console.warn(`[OTP] Client ${clientId} n'a pas d'email — code OTP non envoyé`);
    }

    try {
      const fcm = getFcmMessaging();
      if (clientData.fcmToken && fcm) {
        await fcm.send({
          token: clientData.fcmToken,
          notification: {
            title: '⚠️ Confirmation de retrait requise',
            body: `L'agent ${agentData.name} souhaite retirer $${usd.toFixed(2)} de votre compte. Ouvrez l'app pour confirmer.`,
          },
        });
      }
    } catch (pushErr) {
      console.warn('[initiate-withdrawal] Push failed:', pushErr);
    }

    // Push SSE event to client immediately
    pushClientEvent(clientId, 'withdrawal_pending', {
      id: confirmRef.id,
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      clientId,
      clientName: clientData.name || '',
      amount: usd,
      ...(note && { note }),
      status: 'pending',
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, confirmId: confirmRef.id, clientName: clientData.name || '', amount: usd });
  } catch (e: any) {
    console.error('[agent/initiate-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: get pending withdrawal confirmations ───────────────────────────────
router.get('/api/agent/pending-withdrawals/:agentCode', requireDb, async (req, res) => {
  try {
    const { agentCode } = req.params;
    const snap = await adminDb.collection('agent_withdrawal_confirmations')
      .where('agentCode', '==', agentCode).where('status', '==', 'pending')
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json({ confirmations: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: cancel pending withdrawal confirmation ─────────────────────────────
router.post('/api/agent/cancel-withdrawal/:confirmId', requireDb, async (req, res) => {
  try {
    const { confirmId } = req.params;
    const { agentCode } = req.body;
    if (!confirmId || !agentCode) return res.status(400).json({ error: 'Paramètres manquants.' });
    const confirmRef = adminDb.collection('agent_withdrawal_confirmations').doc(confirmId);
    const confirmSnap = await confirmRef.get();
    if (!confirmSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    if (confirmSnap.data()!.agentCode !== agentCode) return res.status(403).json({ error: 'Non autorisé.' });
    if (confirmSnap.data()!.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });
    const affectedClientId = confirmSnap.data()!.clientId as string;
    await transitionPending(confirmRef, { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });

    // Notify the client via SSE that the request was cancelled
    pushClientEvent(affectedClientId, 'withdrawal_resolved', { id: confirmId, status: 'cancelled' });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Client: get pending withdrawal confirmations ──────────────────────────────
router.get('/api/client/pending-confirmations/:clientId', requireDb, async (req, res) => {
  try {
    const { clientId } = req.params;
    const snap = await adminDb.collection('agent_withdrawal_confirmations')
      .where('clientId', '==', clientId).where('status', '==', 'pending')
      .orderBy('createdAt', 'desc').limit(10).get();
    res.json({ confirmations: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Client: confirm agent withdrawal ─────────────────────────────────────────
router.post('/api/client/confirm-withdrawal/:confirmId', requireDb, async (req, res) => {
  try {
    const { confirmId } = req.params;
    const { clientId, otpCode } = req.body;
    if (!confirmId || !clientId) return res.status(400).json({ error: 'Paramètres manquants.' });

    const confirmRef = adminDb.collection('agent_withdrawal_confirmations').doc(confirmId);
    const confirmSnap = await confirmRef.get();
    if (!confirmSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const confirmData = confirmSnap.data()!;
    if (confirmData.clientId !== clientId) return res.status(403).json({ error: 'Non autorisé.' });
    if (confirmData.status !== 'pending') return res.status(400).json({ error: 'Cette demande a déjà été traitée.' });

    // SECURITY: OTP verification with brute-force protection.
    // Track failed attempts; block after 5 wrong codes to prevent exhaustion attacks.
    if (confirmData.otpHash) {
      if (!otpCode) return res.status(400).json({ error: 'Code OTP requis.' });
      const failedAttempts = confirmData.otpFailedAttempts || 0;
      if (failedAttempts >= 5) {
        await confirmRef.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
        return res.status(429).json({ error: 'Trop de tentatives incorrectes. La demande a été annulée. Demandez à l\'agent de renouveler.' });
      }
      const submittedHash = createHash('sha256').update(String(otpCode)).digest('hex');
      if (submittedHash !== confirmData.otpHash) {
        await confirmRef.update({ otpFailedAttempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
        const remaining = 4 - failedAttempts;
        return res.status(403).json({ error: `Code OTP incorrect. ${remaining} tentative(s) restante(s) avant blocage.` });
      }
    }

    const expiresAt = confirmData.expiresAt?.toDate ? confirmData.expiresAt.toDate() : new Date(confirmData.expiresAt);
    if (new Date() > expiresAt) {
      await confirmRef.update({ status: 'expired', updatedAt: FieldValue.serverTimestamp() });
      return res.status(400).json({ error: 'Cette demande a expiré. Demandez à l\'agent de renouveler.' });
    }

    const amount = Number(confirmData.amount);
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings = settingsSnap.exists ? settingsSnap.data()! : {};
    const agentWithdrawPct = Number(feeSettings.agentWithdrawPercent || 0);
    const agentWithdrawAgentSharePct = Number(feeSettings.agentWithdrawAgentSharePercent ?? 100);
    const totalFee = parseFloat((amount * agentWithdrawPct / 100).toFixed(4));
    const agentShareFee = parseFloat((totalFee * agentWithdrawAgentSharePct / 100).toFixed(4));
    const adminShareFee = parseFloat((totalFee - agentShareFee).toFixed(4));

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', confirmData.agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentRef = agentSnap.docs[0].ref;
    const agentData = agentSnap.docs[0].data();
    const agentId = agentSnap.docs[0].id;
    const clientRef = adminDb.collection('clients').doc(clientId);

    await adminDb.runTransaction(async (txn) => {
      const [latestConfirmSnap, cSnap] = await Promise.all([
        txn.get(confirmRef),
        txn.get(clientRef),
      ]);
      if (!latestConfirmSnap.exists || latestConfirmSnap.data()!.status !== 'pending') {
        throw new Error('Cette demande a déjà été traitée.');
      }
      if (latestConfirmSnap.data()!.clientId !== clientId) throw new Error('Accès refusé.');
      if (!cSnap.exists) throw new Error('Client introuvable.');
      if ((cSnap.data()!.balance || 0) < amount) throw new Error('Solde client insuffisant.');

      txn.update(clientRef, { balance: FieldValue.increment(-amount), updatedAt: FieldValue.serverTimestamp() });
      txn.update(agentRef, {
        balance: FieldValue.increment(amount - adminShareFee),
        commissionBalance: FieldValue.increment(agentShareFee),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (adminShareFee > 0) {
        txn.update(adminDb.collection('settings').doc('global'), { feesBalance: FieldValue.increment(adminShareFee) });
      }

      const txRef = adminDb.collection('client_transactions').doc();
      txn.set(txRef, {
        clientId, clientName: confirmData.clientName || '',
        type: 'withdrawal', amount, status: 'approved',
        method: `Agent: ${agentData.name}`,
        agentCode: confirmData.agentCode, agentName: agentData.name || '', agentId,
        source: 'agent_confirmed_withdrawal',
        description: `Retrait confirmé par client via Agent ${agentData.name}${confirmData.note ? ` — ${confirmData.note}` : ''}`,
        ...(confirmData.note && { message: confirmData.note }),
        ...(totalFee > 0 && { fee: totalFee, agentFeeShare: agentShareFee, adminFeeShare: adminShareFee }),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });

      if (totalFee > 0) {
        txn.set(adminDb.collection('agent_fee_records').doc(), {
          agentId, agentCode: confirmData.agentCode, agentName: agentData.name || '',
          clientId, clientName: confirmData.clientName || '',
          operationType: 'withdrawal', baseAmount: amount,
          feeTotal: totalFee, agentShare: agentShareFee, adminShare: adminShareFee,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      txn.update(confirmRef, { status: 'confirmed', confirmedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'agent_withdrawal_confirmed_by_client',
        clientId, clientName: confirmData.clientName || '',
        agentCode: confirmData.agentCode, agentName: agentData.name || '',
        amount, read: false, createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Notify any other SSE listeners (e.g., agent watching for confirmation)
    pushClientEvent(clientId, 'withdrawal_resolved', { id: confirmId, status: 'confirmed', amount });

    // Resend email — confirmation retrait agent
    adminDb.collection('clients').doc(clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentWithdrawalConfirmed({ clientName: confirmData.clientName || '', clientEmail, agentName: agentData.name || '', amount }),
        { type: 'agent_withdrawal_confirmed', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId, amount }
      );
    }).catch(() => {});

    res.json({ success: true, amount });
  } catch (e: any) {
    console.error('[client/confirm-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Client: reject agent withdrawal ──────────────────────────────────────────
router.post('/api/client/reject-withdrawal/:confirmId', requireDb, async (req, res) => {
  try {
    const { confirmId } = req.params;
    const { clientId } = req.body;
    if (!confirmId || !clientId) return res.status(400).json({ error: 'Paramètres manquants.' });

    const confirmRef = adminDb.collection('agent_withdrawal_confirmations').doc(confirmId);
    const confirmSnap = await confirmRef.get();
    if (!confirmSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const confirmData = confirmSnap.data()!;
    if (confirmData.clientId !== clientId) return res.status(403).json({ error: 'Non autorisé.' });
    if (confirmData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    await transitionPending(confirmRef, { status: 'rejected', rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    // Remove from client's SSE stream
    pushClientEvent(clientId, 'withdrawal_resolved', { id: confirmId, status: 'rejected' });

    res.json({ success: true });
  } catch (e: any) {
    console.error('[client/reject-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Client: request deposit via affiliate/agent (pending, affiliate confirms) ──
router.post('/api/client/agent-deposit', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, amount, affiliateCode, message } = req.body;
    if (!clientId || !clientName || !amount || !affiliateCode)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    // Resolve affiliate
    const affSnap = await adminDb.collection('affiliates').where('code', '==', affiliateCode.trim()).limit(1).get();
    if (affSnap.empty) return res.status(404).json({ error: 'Affilié introuvable avec ce code.' });
    const affDoc = affSnap.docs[0];
    const affData = affDoc.data();

    // Anti-double
    const pendingCheck = await adminDb.collection('client_transactions')
      .where('clientId', '==', clientId)
      .where('type', '==', 'deposit')
      .where('status', '==', 'pending')
      .where('source', '==', 'client_deposit_request')
      .limit(1).get();
    if (!pendingCheck.empty)
      return res.status(400).json({ error: 'Une demande de dépôt via agent est déjà en cours.' });

    const txDocRef = adminDb.collection('client_transactions').doc();
    await txDocRef.set({
      clientId,
      clientName,
      type: 'deposit',
      amount: usd,
      usdAmount: usd,
      status: 'pending',
      method: 'Agent',
      affiliateId: affDoc.id,
      affiliateName: affData.name || '',
      affiliateCode: affiliateCode.trim(),
      source: 'client_deposit_request',
      description: `Dépôt via Affilié ${affData.name}${message ? ` — ${message}` : ''}`,
      ...(message && { message }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notify affiliate of new client deposit request
    fireEmail(
      () => emailAgentNewRequest({ agentName: affData.name || '', agentEmail: affData.email, clientName, type: 'deposit', amount: usd }),
      { type: 'affiliate_new_deposit_request', to: affData.email || '', amount: usd },
    );

    res.json({ success: true, affiliateName: affData.name || '', transactionId: txDocRef.id });
  } catch (e: any) {
    console.error('[client/agent-deposit]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: get pending client withdrawal requests ─────────────────────────────
router.get('/api/agent/withdrawal-requests/:agentCode', requireDb, async (req, res) => {
  try {
    const { agentCode } = req.params;
    if (!agentCode) return res.status(400).json({ error: 'agentCode requis.' });
    const snap = await adminDb.collection('client_transactions')
      .where('agentCode', '==', agentCode)
      .where('source', '==', 'agent_withdrawal_request')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50).get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: confirm client withdrawal request ──────────────────────────────────
// Atomic: debit client, credit agent (they receive digital value for giving cash), fees
router.post('/api/agent/withdrawal-request/:txId/confirm', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { agentCode } = req.body;
    if (!agentCode) return res.status(400).json({ error: 'agentCode requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.agentCode !== agentCode) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Cette demande a déjà été traitée.' });
    if (txData.source !== 'agent_withdrawal_request') return res.status(400).json({ error: 'Type de transaction invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentRef = agentSnap.docs[0].ref;
    const agentData = agentSnap.docs[0].data();
    const agentId = agentSnap.docs[0].id;
    const amount = Number(txData.amount || txData.usdAmount || 0);

    // Check agent has sufficient balance before proceeding
    if ((agentData.balance || 0) < amount) {
      return res.status(400).json({ error: 'Solde agent insuffisant pour traiter ce retrait.' });
    }

    // Load fee settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings = settingsSnap.exists ? settingsSnap.data()! : {};
    const agentWithdrawPct = Number(feeSettings.agentWithdrawPercent || 0);
    const agentWithdrawAgentSharePct = Number(feeSettings.agentWithdrawAgentSharePercent ?? 100);
    const totalFee = parseFloat((amount * agentWithdrawPct / 100).toFixed(4));
    const agentShareFee = parseFloat((totalFee * agentWithdrawAgentSharePct / 100).toFixed(4));
    const adminShareFee = parseFloat((totalFee - agentShareFee).toFixed(4));

    await adminDb.runTransaction(async (txn) => {
      const clientRef = adminDb.collection('clients').doc(txData.clientId);
      const [latestTxSnap, clientSnap, agentSnapTxn] = await Promise.all([
        txn.get(txRef),
        txn.get(clientRef),
        txn.get(agentRef),
      ]);
      if (!latestTxSnap.exists || latestTxSnap.data()!.status !== 'pending') {
        throw new Error('Cette demande a déjà été traitée.');
      }
      if (latestTxSnap.data()!.agentCode !== agentCode || latestTxSnap.data()!.source !== 'agent_withdrawal_request') {
        throw new Error('Accès refusé.');
      }
      if (!clientSnap.exists) throw new Error('Client introuvable.');
      const clientBalance = clientSnap.data()!.balance || 0;
      if (clientBalance < amount) throw new Error('Solde client insuffisant pour ce retrait.');

      // Re-fetch agent balance inside transaction for consistency
      const agentBalanceTxn = agentSnapTxn.exists ? (agentSnapTxn.data()!.balance || 0) : 0;
      if (agentBalanceTxn < amount) throw new Error('Solde agent insuffisant pour traiter ce retrait.');

      // Debit client balance
      txn.update(clientRef, {
        balance: FieldValue.increment(-amount),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Debit agent balance: agent pays out cash to client, balance decreases.
      // Commission credited separately for their share of the fee.
      txn.update(agentRef, {
        balance: FieldValue.increment(-amount),
        commissionBalance: FieldValue.increment(agentShareFee),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Admin fee
      if (adminShareFee > 0) {
        txn.update(adminDb.collection('settings').doc('global'), {
          feesBalance: FieldValue.increment(adminShareFee),
        });
      }

      // Approve tx
      txn.update(txRef, {
        status: 'approved',
        agentConfirmedAt: FieldValue.serverTimestamp(),
        ...(totalFee > 0 && { fee: totalFee, agentFeeShare: agentShareFee, adminFeeShare: adminShareFee }),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Fee record
      if (totalFee > 0) {
        txn.set(adminDb.collection('agent_fee_records').doc(), {
          agentId, agentCode, agentName: agentData.name || '',
          clientId: txData.clientId, clientName: txData.clientName || '',
          operationType: 'withdrawal', baseAmount: amount,
          feeTotal: totalFee, agentShare: agentShareFee, adminShare: adminShareFee,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Client notification — show net amount they actually receive
      const netForNotif = parseFloat((amount - totalFee).toFixed(4));
      txn.set(adminDb.collection('client_notifications').doc(), {
        clientId: txData.clientId,
        type: 'withdrawal_approved',
        title: '✅ Retrait confirmé par l\'agent',
        message: `Votre retrait a été confirmé par l'agent ${agentData.name}. Récupérez $${netForNotif.toFixed(2)} USD en cash auprès de l'agent.`,
        amount, read: false, createdAt: FieldValue.serverTimestamp(),
      });

      // Admin notification
      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'agent_withdrawal_confirmed',
        clientId: txData.clientId, clientName: txData.clientName || '',
        agentCode, agentName: agentData.name || '', amount,
        read: false, createdAt: FieldValue.serverTimestamp(),
      });
    });

    const netForPush = parseFloat((amount - totalFee).toFixed(4));
    sendFcmToClient(
      txData.clientId,
      '✅ Retrait confirmé',
      `Votre retrait a été confirmé par l'agent ${agentData.name}. Récupérez ${netForPush.toFixed(2)} USD en cash.`,
      { type: 'withdrawal_approved', txId }
    );

    // Email to client + admin: agent confirmed withdrawal
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: agentData.name || '', clientName: txData.clientName || '', clientEmail, type: 'withdrawal', action: 'confirmed', amount }),
        { type: 'agent_withdrawal_confirmed_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[agent/withdrawal-request/confirm]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: reject client withdrawal request ───────────────────────────────────
router.post('/api/agent/withdrawal-request/:txId/reject', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { agentCode, reason } = req.body;
    if (!agentCode) return res.status(400).json({ error: 'agentCode requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.agentCode !== agentCode) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Cette demande a déjà été traitée.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentData = agentSnap.docs[0].data();
    const amount = Number(txData.amount || txData.usdAmount || 0);

    await adminDb.runTransaction(async (txn) => {
      const latestTx = await txn.get(txRef);
      if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Cette demande a déjà été traitée.');
      if (latestTx.data()!.agentCode !== agentCode || latestTx.data()!.source !== 'agent_withdrawal_request') {
        throw new Error('Accès refusé.');
      }
      txn.update(txRef, {
        status: 'rejected', ...(reason && { rejectionReason: reason }),
        agentRejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(adminDb.collection('client_notifications').doc(), {
        clientId: txData.clientId, type: 'withdrawal_rejected',
        title: '❌ Demande de retrait refusée',
        message: `Votre demande de retrait de $${amount.toFixed(2)} via l'agent ${agentData.name} a été refusée.${reason ? ` Raison: ${reason}` : ''}`,
        amount, read: false, createdAt: FieldValue.serverTimestamp(),
      });
    });

    sendFcmToClient(
      txData.clientId,
      '❌ Retrait refusé',
      `Votre demande de retrait de ${amount.toFixed(2)} a été refusée par l'agent ${agentData.name}.`,
      { type: 'withdrawal_rejected', txId }
    );

    // Email to client + admin: agent rejected withdrawal
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: agentData.name || '', clientName: txData.clientName || '', clientEmail, type: 'withdrawal', action: 'rejected', amount, reason }),
        { type: 'agent_withdrawal_rejected_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[agent/withdrawal-request/reject]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: set / change PIN ───────────────────────────────────────────────────
router.post('/api/agent/set-pin', requireDb, async (req, res) => {
  try {
    const { agentCode, pin } = req.body;
    if (!agentCode || !pin) return res.status(400).json({ error: 'agentCode et pin requis.' });
    if (!/^\d{8}$/.test(String(pin))) return res.status(400).json({ error: 'Le PIN doit comporter exactement 8 chiffres.' });
    const snap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    await snap.docs[0].ref.update({ pinHash: hashPin(String(pin)), updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: check if PIN is configured ────────────────────────────────────────
router.get('/api/agent/has-pin/:agentCode', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('agents').where('agentCode', '==', req.params.agentCode).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    res.json({ hasPin: !!snap.docs[0].data().pinHash });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: set / change PIN ───────────────────────────────────────────────
router.post('/api/affiliate/set-pin', requireDb, async (req, res) => {
  try {
    const { affiliateId, pin } = req.body;
    if (!affiliateId || !pin) return res.status(400).json({ error: 'affiliateId et pin requis.' });
    if (!/^\d{8}$/.test(String(pin))) return res.status(400).json({ error: 'Le PIN doit comporter exactement 8 chiffres.' });
    const ref = adminDb.collection('affiliates').doc(affiliateId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    await ref.update({ pinHash: hashPin(String(pin)), updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: check if PIN is configured ─────────────────────────────────────
router.get('/api/affiliate/has-pin/:affiliateId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('affiliates').doc(req.params.affiliateId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    res.json({ hasPin: !!snap.data()?.pinHash });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: personal deposit (client deposits into agent wallet) ───────────────
router.post('/api/agent/personal-deposit', requireDb, async (req, res) => {
  try {
    const { agentCode, amount, method, accountNumber, accountName, message, pin } = req.body;
    if (!agentCode || !amount || !method) return res.status(400).json({ error: 'Champs requis manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(400).json({ error: 'Agent inactif.' });
    if (!agentData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), agentData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });

    const txRef = adminDb.collection('agent_personal_transactions').doc();
    const operationId = res.locals.financialOperationId as string | undefined;
    const operationRef = operationId ? adminDb.collection('financial_operations').doc(operationId) : null;
    await adminDb.runTransaction(async (txn) => {
      if (operationRef) {
        const existingOperation = await txn.get(operationRef);
        if (existingOperation.exists) throw new Error('Cette demande a déjà été reçue.');
      }
      txn.set(txRef, {
        agentId: agentDoc.id, agentCode, agentName: agentData.name || '',
        type: 'deposit', amount: usd, method,
        ...(accountNumber && { accountNumber }), ...(accountName && { accountName }), ...(message && { message }),
        status: 'pending', description: `Dépôt personnel — ${method}`,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'agent_personal_deposit', agentId: agentDoc.id, agentCode,
        agentName: agentData.name || '', amount: usd, method, read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      if (operationRef) txn.set(operationRef, {
        type: 'agent_personal_deposit', targetId: txRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Email to admin
    fireEmail(
      () => emailDepositSubmitted({
        clientName: `Agent: ${agentData.name || agentCode}`,
        clientEmail: undefined,
        amount: usd,
        method,
        txId: txRef.id,
      }),
      { type: 'agent_personal_deposit', to: ADMIN_EMAIL, amount: usd }
    );

    res.json({ success: true, txId: txRef.id });
  } catch (e: any) {
    console.error('[agent/personal-deposit]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: personal withdrawal (agent withdraws from own commission balance) ──
router.post('/api/agent/personal-withdrawal', requireDb, async (req, res) => {
  try {
    const { agentCode, amount, method, accountNumber, accountName, message, pin } = req.body;
    if (!agentCode || !amount || !method || !accountNumber) return res.status(400).json({ error: 'Champs requis manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(400).json({ error: 'Agent inactif.' });
    if (!agentData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), agentData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });

    const txRef = adminDb.collection('agent_personal_transactions').doc();
    await adminDb.runTransaction(async (txn) => {
      const latestAgent = await txn.get(agentDoc.ref);
      if (!latestAgent.exists) throw new Error('Agent introuvable.');
      const latestData = latestAgent.data()!;
      const commissionBalance = Number(latestData.commissionBalance || 0);
      if (commissionBalance < usd) throw new Error(`Solde commissions insuffisant. Disponible: $${commissionBalance.toFixed(2)}`);
      txn.update(agentDoc.ref, {
        commissionBalance: FieldValue.increment(-usd),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(txRef, {
        agentId: agentDoc.id, agentCode, agentName: latestData.name || '',
        type: 'withdrawal', amount: usd, method, accountNumber,
        ...(accountName && { accountName }), ...(message && { message }),
        status: 'pending', description: `Retrait commissions — ${method} — ${accountNumber}`,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'agent_personal_withdrawal', agentId: agentDoc.id, agentCode,
        agentName: latestData.name || '', amount: usd, method, accountNumber,
        read: false, createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Email to admin
    fireEmail(
      () => emailWithdrawalSubmitted({
        clientName: `Agent: ${agentData.name || agentCode}`,
        clientEmail: agentData.email || undefined,
        amount: usd,
        method,
        accountNumber,
        accountName: accountName || agentData.name,
      }),
      { type: 'agent_personal_withdrawal', to: ADMIN_EMAIL, amount: usd }
    );

    res.json({ success: true, txId: txRef.id });
  } catch (e: any) {
    console.error('[agent/personal-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: personal transaction history ──────────────────────────────────────
router.get('/api/agent/personal-transactions/:agentId', requireDb, async (req, res) => {
  try {
    const { agentId } = req.params;
    const snap = await adminDb.collection('agent_personal_transactions')
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc')
      .limit(100).get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: approve agent personal deposit ────────────────────────────────────
router.post('/api/admin/agent-personal-deposit/:txId/approve', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const txRef = adminDb.collection('agent_personal_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });
    if (txData.type !== 'deposit') return res.status(400).json({ error: 'Type invalide.' });

    const agentRef = adminDb.collection('agents').doc(txData.agentId);
    await adminDb.runTransaction(async (txn) => {
      const [latestTxSnap, agentSnap] = await Promise.all([
        txn.get(txRef),
        txn.get(agentRef),
      ]);
      if (!latestTxSnap.exists || latestTxSnap.data()!.status !== 'pending') {
        throw new Error('Demande déjà traitée.');
      }
      if (latestTxSnap.data()!.agentId !== txData.agentId || latestTxSnap.data()!.type !== 'deposit') throw new Error('Accès refusé.');
      if (!agentSnap.exists) throw new Error('Agent introuvable.');
      txn.update(agentRef, {
        balance: FieldValue.increment(txData.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.update(txRef, { status: 'approved', approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });

    // Notify agent by email
    const agentSnap = await agentRef.get();
    const agentData = agentSnap.exists ? agentSnap.data()! : {};
    if (agentData.email) {
      fireEmail(
        () => emailDepositApproved({ clientName: `Agent ${agentData.name || txData.agentCode}`, clientEmail: agentData.email, amount: txData.amount }),
        { type: 'agent_personal_deposit_approved', to: agentData.email, amount: txData.amount },
      );
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: reject agent personal deposit ─────────────────────────────────────
router.post('/api/admin/agent-personal-deposit/:txId/reject', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { reason } = req.body;
    const txRef = adminDb.collection('agent_personal_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    // If it was a withdrawal that debited commission balance, refund it
    if (txData.type === 'withdrawal') {
      const agentRef = adminDb.collection('agents').doc(txData.agentId);
      await adminDb.runTransaction(async (txn) => {
        const latestTx = await txn.get(txRef);
        if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Déjà traitée.');
        if (latestTx.data()!.agentId !== txData.agentId || latestTx.data()!.type !== 'withdrawal') throw new Error('Accès refusé.');
        txn.update(agentRef, { commissionBalance: FieldValue.increment(txData.amount), updatedAt: FieldValue.serverTimestamp() });
        txn.update(txRef, { status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
    } else {
      await transitionPending(txRef, { status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: approve agent personal withdrawal ─────────────────────────────────
router.post('/api/admin/agent-personal-withdrawal/:txId/approve', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const txRef = adminDb.collection('agent_personal_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });
    if (txData.type !== 'withdrawal') return res.status(400).json({ error: 'Type invalide.' });
    await transitionPending(txRef, { status: 'approved', approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Self-deposit request (agent recharges own balance) ────────────────────────
router.post('/api/agent/self-deposit-request', requireDb, async (req, res) => {
  try {
    const { agentCode, amount, method } = req.body;
    if (!agentCode || !amount || !method) return res.status(400).json({ error: 'Champs requis manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();

    await adminDb.collection('agent_deposit_requests').add({
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      amount: usd,
      method,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('[agent/self-deposit-request]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: full transaction history ──────────────────────────────────────────
router.get('/api/agent/transactions/:agentCode', requireDb, async (req, res) => {
  try {
    const { agentCode } = req.params;
    const snap = await adminDb.collection('client_transactions')
      .where('agentCode', '==', agentCode)
      .orderBy('createdAt', 'desc')
      .limit(200).get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: commission / fee records ──────────────────────────────────────────
router.get('/api/agent/fee-records/:agentId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('agent_fee_records')
      .where('agentId', '==', req.params.agentId)
      .orderBy('createdAt', 'desc')
      .limit(100).get();
    res.json({ records: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: stats ──────────────────────────────────────────────────────────────
router.get('/api/agent/stats/:agentCode', requireDb, async (req, res) => {
  try {
    const { agentCode } = req.params;
    const snap = await adminDb.collection('client_transactions')
      .where('agentCode', '==', agentCode)
      .where('status', '==', 'approved')
      .get();
    let totalDeposits = 0, totalWithdrawals = 0, totalCommissions = 0, depositCount = 0, withdrawalCount = 0;
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (d.type === 'deposit') {
        totalDeposits += d.amount || 0;
        totalCommissions += d.agentCommission || 0;
        depositCount++;
      } else if (d.type === 'withdrawal') {
        totalWithdrawals += d.amount || 0;
        totalCommissions += d.agentFeeShare || 0;
        withdrawalCount++;
      }
    });
    res.json({ totalDeposits, totalWithdrawals, totalCommissions, depositCount, withdrawalCount, totalTransactions: snap.size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Client-to-client transfer ─────────────────────────────────────────────────
router.post('/api/client/transfer', requireDb, async (req, res) => {
  try {
    const { senderClientId, recipientWalletId, amount, message } = req.body;
    if (!senderClientId || !recipientWalletId || !amount)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });

    const senderRef = adminDb.collection('clients').doc(senderClientId);

    // Find recipient by walletId
    const recipSnap = await adminDb.collection('clients')
      .where('walletId', '==', recipientWalletId.trim()).limit(1).get();
    if (recipSnap.empty)
      return res.status(404).json({ error: 'Aucun wallet trouvé avec cet ID.' });
    const recipDoc = recipSnap.docs[0];
    if (recipDoc.id === senderClientId)
      return res.status(400).json({ error: 'Vous ne pouvez pas vous transférer à vous-même.' });

    // Load transfer fee
    const settSnap = await adminDb.collection('settings').doc('global').get();
    const transferFeePercent = settSnap.exists ? (settSnap.data()!.transferFeePercent || 0) : 0;
    const feeAmount = transferFeePercent > 0
      ? parseFloat((usd * transferFeePercent / 100).toFixed(4))
      : 0;
    const netToRecipient = usd - feeAmount;

    let recipientName = '';
    await adminDb.runTransaction(async (tx) => {
      const [senderSnap, recipientSnap] = await Promise.all([tx.get(senderRef), tx.get(recipDoc.ref)]);
      if (!senderSnap.exists || !recipientSnap.exists) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
      const senderData = senderSnap.data()!;
      const recipData = recipientSnap.data()!;
      recipientName = recipData.name || '';
      if (Number(senderData.balance || 0) < usd) throw Object.assign(new Error('Solde insuffisant.'), { status: 400 });

      tx.update(senderRef, { balance: FieldValue.increment(-usd), updatedAt: FieldValue.serverTimestamp() });
      tx.update(recipDoc.ref, { balance: FieldValue.increment(netToRecipient), updatedAt: FieldValue.serverTimestamp() });
      if (feeAmount > 0) {
        tx.update(adminDb.collection('settings').doc('global'), {
          feesBalance: FieldValue.increment(feeAmount),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      tx.set(adminDb.collection('client_transactions').doc(), {
        clientId: senderClientId, clientName: senderData.name || '', type: 'withdrawal',
        amount: usd, usdAmount: usd, status: 'completed', method: 'Transfert Wallet',
        description: `Transfert vers ${recipData.name || recipientWalletId}${feeAmount > 0 ? ` (frais: $${feeAmount.toFixed(2)})` : ''}${message ? ` — ${message}` : ''}`,
        recipientWalletId: recipientWalletId.trim(), recipientName: recipData.name || '',
        ...(message && { message }), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(adminDb.collection('client_transactions').doc(), {
        clientId: recipDoc.id, clientName: recipData.name || '', type: 'transfer_received',
        amount: netToRecipient, usdAmount: netToRecipient, status: 'completed', method: 'Transfert Wallet',
        description: `Reçu de ${senderData.name || senderClientId}${message ? ` — ${message}` : ''}`,
        senderWalletId: senderData.walletId || '', senderName: senderData.name || '',
        ...(message && { message }), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, recipientName, amount: netToRecipient, fee: feeAmount });
  } catch (e: any) {
    console.error('[transfer]', e);
    res.status(e.status || 500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Lookup client by walletId (for transfer preview) ─────────────────────────
router.get('/api/client/lookup-wallet', requireDb, async (req, res) => {
  try {
    const { walletId } = req.query;
    if (!walletId || typeof walletId !== 'string')
      return res.status(400).json({ error: 'walletId requis.' });
    const snap = await adminDb.collection('clients')
      .where('walletId', '==', walletId.trim()).limit(1).get();
    if (snap.empty) return res.json({ name: null });
    const data = snap.docs[0].data();
    res.json({ name: data.name || null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate submits deposit for a client (agent mode) ───────────────────────
router.get('/api/admin/affiliate-requests', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('client_requests')
      .where('source', '==', 'affiliate')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/admin/affiliate-requests/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    if (!action || !['approve', 'decline'].includes(action))
      return res.status(400).json({ error: 'Action invalide.' });
    const reqRef = adminDb.collection('client_requests').doc(id);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });
    if (action === 'approve') {
      const clientRef = adminDb.collection('clients').doc(reqData.clientId);
      const clientSnap = await clientRef.get();
      if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
      const clientData = clientSnap.data()!;
      const exchangeRate = 146;
      const htgAmount = reqData.amount * exchangeRate;
      const batch = adminDb.batch();
      batch.update(clientRef, {
        balance: (clientData.balance || 0) + htgAmount,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('client_transactions').doc(), {
        clientId: reqData.clientId,
        clientName: reqData.clientName,
        type: 'deposit',
        amount: htgAmount,
        status: 'approved',
        method: reqData.method || '',
        description: `Dépôt via affilié ${reqData.affiliateName || ''} (approuvé)`,
        source: 'affiliate',
        affiliateId: reqData.affiliateId || '',
        affiliateName: reqData.affiliateName || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('client_notifications').doc(), {
        clientId: reqData.clientId,
        type: 'deposit_approved',
        title: 'Dépôt approuvé',
        message: `Votre dépôt de ${htgAmount.toLocaleString()} HTG a été approuvé.`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      batch.update(reqRef, { status: 'approved', resolvedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      // Email notification
      fireEmail(
        () => emailDepositApproved({ clientName: reqData.clientName || '', clientEmail: clientData.email || undefined, amount: htgAmount / (reqData.exchangeRate || 146) }),
        { type: 'affiliate_deposit_approved', to: [ADMIN_EMAIL, ...(clientData.email ? [clientData.email] : [])], clientId: reqData.clientId, amount: htgAmount }
      );
    } else {
      const clientSnap2 = await adminDb.collection('clients').doc(reqData.clientId).get();
      const clientEmail2 = clientSnap2.exists ? clientSnap2.data()?.email : undefined;
      await reqRef.update({ status: 'declined', resolvedAt: FieldValue.serverTimestamp() });
      // Email notification
      fireEmail(
        () => emailDepositRejected({ clientName: reqData.clientName || '', clientEmail: clientEmail2, amount: reqData.amount || 0 }),
        { type: 'affiliate_deposit_declined', to: [ADMIN_EMAIL, ...(clientEmail2 ? [clientEmail2] : [])], clientId: reqData.clientId, amount: reqData.amount }
      );
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: Credential login (server-side, phase 1 → 2FA) ─────────────────
router.post('/api/affiliate/login', requireDb, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiants requis.' });

    const snap = await adminDb.collection('affiliates')
      .where('username', '==', username.trim())
      .limit(1).get();

    if (snap.empty) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const affDoc = snap.docs[0];
    const affData = affDoc.data();
    const storedPassword = affData.passwordHash || affData.password;
    if (!verifyPassword(password, storedPassword)) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }
    if (!affData.passwordHash) {
      await affDoc.ref.update({
        passwordHash: hashPassword(password),
        password: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const email: string | undefined = affData.email || affData.info?.email;

    if (!email) {
      return res.status(422).json({ error: 'Aucun email configuré sur ce compte affilié. Contactez l\'administrateur.' });
    }

    const { sessionId, otpPlain } = await create2FASession({
      role: 'affiliate',
      accountId: affDoc.id,
      email,
      name: affData.name || username,
    });
    await send2FAOtp({ email, name: affData.name || username, role: 'affiliate', otpCode: otpPlain, expiresMinutes: 5 });

    res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(email) });
  } catch (e: any) {
    console.error('[affiliate/login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// ── Affiliate: Google login (server-side, phase 1 → 2FA) ─────────────────────
router.post('/api/affiliate/google-login', requireDb, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Jeton Google requis.' });
    const token = await getAuth().verifyIdToken(idToken);
    const uid = token.uid;
    const email = token.email?.toLowerCase();
    const name = token.name || '';
    if (!uid || !email || !token.email_verified) return res.status(401).json({ error: 'Compte Google non vérifié.' });

    // Look up affiliate by email
    let affSnap = await adminDb.collection('affiliates').where('email', '==', email.toLowerCase()).limit(1).get();
    if (affSnap.empty) {
      affSnap = await adminDb.collection('affiliates').where('info.email', '==', email.toLowerCase()).limit(1).get();
    }
    if (affSnap.empty) return res.json({ noAccount: true });

    const affDoc = affSnap.docs[0];
    const affData = affDoc.data();
    const affEmail: string = affData.email || affData.info?.email || email.toLowerCase();

    // Save Google uid
    await affDoc.ref.update({ uid, updatedAt: FieldValue.serverTimestamp() });

    const { sessionId, otpPlain } = await create2FASession({
      role: 'affiliate',
      accountId: affDoc.id,
      email: affEmail,
      name: affData.name || name || '',
    });
    await send2FAOtp({ email: affEmail, name: affData.name || name || 'Affilié', role: 'affiliate', otpCode: otpPlain, expiresMinutes: 5 });

    res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(affEmail) });
  } catch (e: any) {
    console.error('[affiliate/google-login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion Google.' });
  }
});

// ── Affiliate: Verify 2FA OTP ─────────────────────────────────────────────────
router.post('/api/affiliate/verify-2fa', requireDb, async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) return res.status(400).json({ error: 'Paramètres manquants.' });

    const result = await verify2FASession(sessionId, code, 'affiliate');
    if (!result.ok) return res.status(401).json({ error: result.error });

    const affSnap = await adminDb.collection('affiliates').doc(result.accountId!).get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Compte affilié introuvable.' });
    if (affSnap.data()?.disabled === true || affSnap.data()?.status === 'inactive') {
      return res.status(403).json({ error: 'Ce compte affilié est inactif.' });
    }

    const affiliate = { id: affSnap.id, ...affSnap.data() };
    delete (affiliate as any).password;
    setAffiliateSession(res, affSnap.id);
    res.json({ success: true, affiliate });
  } catch (e: any) {
    console.error('[affiliate/verify-2fa]', e);
    res.status(500).json({ error: 'Erreur de vérification.' });
  }
});

router.post('/api/affiliate/logout', (_req, res) => {
  res.clearCookie('rena_affiliate_session', { path: '/' });
  res.json({ success: true });
});

// ── Auth: Resend 2FA OTP (unified for all roles) ──────────────────────────────
router.post('/api/auth/resend-2fa', requireDb, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requis.' });

    const snap = await adminDb.collection('otp_sessions').doc(sessionId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Session introuvable. Veuillez vous reconnecter.' });

    const d = snap.data()!;
    // Delete old session
    await adminDb.collection('otp_sessions').doc(sessionId).delete().catch(() => {});

    // Create fresh session
    const { sessionId: newId, otpPlain } = await create2FASession({
      role: d.role,
      accountId: d.accountId,
      email: d.email,
      name: d.name,
      extra: d.extra,
    });
    await send2FAOtp({ email: d.email, name: d.name, role: d.role as any, otpCode: otpPlain, expiresMinutes: 5 });

    res.json({ success: true, sessionId: newId, maskedEmail: maskEmail(d.email) });
  } catch (e: any) {
    console.error('[auth/resend-2fa]', e);
    res.status(500).json({ error: 'Erreur lors du renvoi du code.' });
  }
});

// ── Affiliate as Agent: search client by phone (legacy) ──────────────────────
router.get('/api/affiliate/client-by-phone', requireDb, async (req, res) => {
  try {
    const phone = (req.query.phone as string || '').trim();
    const affiliateId = (req.query.affiliateId as string || '').trim();
    if (!phone || !affiliateId) return res.status(400).json({ error: 'phone et affiliateId requis.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(403).json({ error: 'Affilié introuvable.' });

    const clientSnap = await adminDb.collection('clients').where('phone', '==', phone).limit(1).get();
    if (clientSnap.empty) return res.status(404).json({ error: 'Aucun client trouvé avec ce numéro.' });
    const clientDoc = clientSnap.docs[0];
    const clientData = clientDoc.data();
    res.json({
      found: true,
      clientId: clientDoc.id,
      name: clientData.name || '',
      phone: clientData.phone || '',
      walletId: clientData.walletId || '',
      balance: clientData.balance || 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate as Agent: multi-field client search ─────────────────────────────
router.get('/api/affiliate/client-search', requireDb, async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const affiliateId = (req.query.affiliateId as string || '').trim();
    if (!q || !affiliateId) return res.status(400).json({ error: 'q et affiliateId requis.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(403).json({ error: 'Affilié introuvable.' });

    const [byPhone, byWallet, byName] = await Promise.all([
      adminDb.collection('clients').where('phone', '==', q).limit(5).get(),
      adminDb.collection('clients').where('walletId', '==', q).limit(5).get(),
      adminDb.collection('clients').where('name', '>=', q).where('name', '<=', q + '\uf8ff').limit(5).get(),
    ]);

    const seen = new Set<string>();
    const results: any[] = [];
    for (const snap of [byPhone, byWallet, byName]) {
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        const d = doc.data();
        results.push({ clientId: doc.id, name: d.name || '', phone: d.phone || '', walletId: d.walletId || '', balance: d.balance || 0 });
      }
    }

    if (results.length === 0) return res.status(404).json({ error: 'Aucun client trouvé.' });
    res.json({ found: true, results, client: results[0] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate as Agent: direct deposit or withdrawal for client ────────────────
router.post('/api/affiliate/client-direct-tx', requireDb, async (req, res) => {
  try {
    const { affiliateId, clientId, type, amount, note, pin } = req.body;
    if (!affiliateId || !clientId || !type || !amount)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!['deposit', 'withdrawal'].includes(type)) return res.status(400).json({ error: 'Type invalide.' });

    const affRef = adminDb.collection('affiliates').doc(affiliateId);
    const affSnap = await affRef.get();
    if (!affSnap.exists) return res.status(403).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    if (!affData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), affData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;

    const now = FieldValue.serverTimestamp();
    let newClientBalance = Number(clientData.balance || 0);
    await adminDb.runTransaction(async (batch) => {
    const [latestAff, latestClient] = await Promise.all([batch.get(affRef), batch.get(clientRef)]);
    if (!latestAff.exists) throw new Error('Affilié introuvable.');
    if (!latestClient.exists) throw new Error('Client introuvable.');
    const affiliateBalance = Number(latestAff.data()!.balance || 0);
    const clientBalance = Number(latestClient.data()!.balance || 0);
    newClientBalance = clientBalance + (type === 'deposit' ? usd : -usd);
    if (type === 'deposit') {
      // Affiliate gives digital credit → affiliate.balance decreases, client.balance increases
      if (affiliateBalance < usd) throw new Error('Solde affilié insuffisant pour ce dépôt.');
      batch.update(affRef, { balance: FieldValue.increment(-usd), updatedAt: now });
      batch.update(clientRef, { balance: FieldValue.increment(usd), updatedAt: now });

      const txRef = adminDb.collection('client_transactions').doc();
      batch.set(txRef, {
        clientId, clientName: clientData.name || '',
        type: 'deposit', amount: usd, usdAmount: usd,
        status: 'approved', method: 'Agent',
        affiliateId, affiliateName: affData.name || '',
        source: 'affiliate_direct_deposit',
        description: `Dépôt direct par agent ${affData.name}${note ? ` — ${note}` : ''}`,
        createdAt: now, updatedAt: now,
      });
      const affTxRef = adminDb.collection('affiliate_transactions').doc();
      batch.set(affTxRef, {
        affiliateId, type: 'client_deposit_given', amount: usd,
        clientId, clientName: clientData.name || '',
        description: `Dépôt pour client ${clientData.name}`, status: 'completed',
        createdAt: now,
      });
    } else {
      // Affiliate pays cash to client → both client.balance and affiliate.balance decrease
      if (clientBalance < usd) throw new Error('Solde client insuffisant.');
      if (affiliateBalance < usd) throw new Error('Solde affilié insuffisant pour effectuer ce retrait.');
      batch.update(clientRef, { balance: FieldValue.increment(-usd), updatedAt: now });
      batch.update(affRef, { balance: FieldValue.increment(-usd), updatedAt: now });

      const txRef = adminDb.collection('client_transactions').doc();
      batch.set(txRef, {
        clientId, clientName: clientData.name || '',
        type: 'withdrawal', amount: usd, usdAmount: usd,
        status: 'approved', method: 'Agent',
        affiliateId, affiliateName: affData.name || '',
        source: 'affiliate_direct_withdrawal',
        description: `Retrait direct par agent ${affData.name}${note ? ` — ${note}` : ''}`,
        createdAt: now, updatedAt: now,
      });
      const affTxRef = adminDb.collection('affiliate_transactions').doc();
      batch.set(affTxRef, {
        affiliateId, type: 'client_withdrawal_given', amount: usd,
        clientId, clientName: clientData.name || '',
        description: `Retrait cash remis à ${clientData.name}`, status: 'completed',
        createdAt: now,
      });
    }
    });
    res.json({ success: true, clientName: clientData.name || '', newClientBalance });
  } catch (e: any) {
    console.error('[affiliate/client-direct-tx]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Affiliate: get pending client withdrawal requests ─────────────────────────
router.get('/api/affiliate/client-withdrawal-requests/:affiliateId', requireDb, async (req, res) => {
  try {
    const { affiliateId } = req.params;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });
    const snap = await adminDb.collection('client_transactions')
      .where('affiliateId', '==', affiliateId)
      .where('source', '==', 'agent_withdrawal_request')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50).get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: confirm client withdrawal request ───────────────────────────────
router.post('/api/affiliate/client-withdrawal/:txId/confirm', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { affiliateId, pin } = req.body;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.affiliateId !== affiliateId) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    const affRef = adminDb.collection('affiliates').doc(affiliateId);
    const affSnap = await affRef.get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    if (!affData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), affData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });

    const clientRef = adminDb.collection('clients').doc(txData.clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    const amount = txData.amount;
    if ((clientData.balance || 0) < amount)
      return res.status(400).json({ error: 'Solde client insuffisant.' });
    if ((affData.balance || 0) < amount)
      return res.status(400).json({ error: 'Solde affilié insuffisant pour effectuer ce retrait.' });

    const now = FieldValue.serverTimestamp();

    // Load withdrawal fee settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const sData = settingsSnap.exists ? settingsSnap.data()! : {};
    const feePercent = Number(sData.withdrawalFeePercent || 0);
    const affiliateSharePct = Number(sData.affiliateWithdrawalFeeSharePercent || 0);
    const feeAmount = feePercent > 0 ? parseFloat((amount * feePercent / 100).toFixed(4)) : 0;
    const affiliateShare = feeAmount > 0 ? parseFloat((feeAmount * affiliateSharePct / 100).toFixed(4)) : 0;
    const adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));

    await adminDb.runTransaction(async (txn) => {
      const [latestTx, latestClient, latestAffiliate] = await Promise.all([
        txn.get(txRef), txn.get(clientRef), txn.get(affRef),
      ]);
      if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Déjà traitée.');
      if (latestTx.data()!.affiliateId !== affiliateId) throw new Error('Accès refusé.');
      if (!latestClient.exists || (latestClient.data()!.balance || 0) < amount) throw new Error('Solde client insuffisant.');
      if (!latestAffiliate.exists || (latestAffiliate.data()!.balance || 0) < amount) throw new Error('Solde affilié insuffisant.');
      txn.update(clientRef, { balance: FieldValue.increment(-amount), updatedAt: now });
      txn.update(affRef, { balance: FieldValue.increment(-amount + affiliateShare), updatedAt: now });
      txn.update(txRef, { status: 'approved', updatedAt: now, confirmedAt: now, confirmedBy: affiliateId,
        ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare, adminFeeShare: adminShare }) });
      if (adminShare > 0) txn.update(adminDb.collection('settings').doc('global'), {
        feesBalance: FieldValue.increment(adminShare), updatedAt: now,
      });
      txn.set(adminDb.collection('affiliate_transactions').doc(), {
        affiliateId, type: 'client_withdrawal_given', amount,
        clientId: txData.clientId, clientName: txData.clientName || '',
        description: `Retrait cash remis à ${txData.clientName}`, status: 'completed',
        ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare }), createdAt: now,
      });
    });

    // Email to client + admin: affiliate confirmed withdrawal
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: affData.name || '', clientName: txData.clientName || '', clientEmail, type: 'withdrawal', action: 'confirmed', amount: txData.amount }),
        { type: 'affiliate_withdrawal_confirmed_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount: txData.amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[affiliate/client-withdrawal/confirm]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Affiliate: reject client withdrawal request ────────────────────────────────
router.post('/api/affiliate/client-withdrawal/:txId/reject', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { affiliateId, reason } = req.body;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.affiliateId !== affiliateId) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    const affSnapWdRej = await adminDb.collection('affiliates').doc(affiliateId).get();
    const affNameWdRej = affSnapWdRej.exists ? (affSnapWdRej.data()?.name || '') : '';
    const now = FieldValue.serverTimestamp();
    await transitionPending(txRef, { status: 'rejected', updatedAt: now, rejectedAt: now, rejectionReason: reason || '' });

    // Email to client + admin: affiliate rejected withdrawal
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      const amount = Number(txData.amount || 0);
      fireEmail(
        () => emailAgentProcessed({ agentName: affNameWdRej, clientName: txData.clientName || '', clientEmail, type: 'withdrawal', action: 'rejected', amount, reason }),
        { type: 'affiliate_withdrawal_rejected_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: get pending client deposit requests ─────────────────────────────
router.get('/api/affiliate/client-deposit-requests/:affiliateId', requireDb, async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const snap = await adminDb.collection('client_transactions')
      .where('affiliateId', '==', affiliateId)
      .where('source', '==', 'client_deposit_request')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(50).get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Affiliate: confirm client deposit request ──────────────────────────────────
router.post('/api/affiliate/client-deposit/:txId/confirm', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { affiliateId, pin } = req.body;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.affiliateId !== affiliateId) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    const affRef = adminDb.collection('affiliates').doc(affiliateId);
    const affSnap = await affRef.get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    if (!affData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), affData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });
    const amount = txData.amount;
    if ((affData.balance || 0) < amount)
      return res.status(400).json({ error: 'Solde affilié insuffisant pour confirmer ce dépôt.' });

    const clientRef = adminDb.collection('clients').doc(txData.clientId);
    const now = FieldValue.serverTimestamp();

    // Load deposit fee settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const sData = settingsSnap.exists ? settingsSnap.data()! : {};
    const feePercent = Number(sData.depositFeePercent || 0);
    const affiliateSharePct = Number(sData.affiliateDepositFeeSharePercent || 0);
    const feeAmount = feePercent > 0 ? parseFloat((amount * feePercent / 100).toFixed(4)) : 0;
    const affiliateShare = feeAmount > 0 ? parseFloat((feeAmount * affiliateSharePct / 100).toFixed(4)) : 0;
    const adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));
    const netToClient = parseFloat((amount - feeAmount).toFixed(4));

    await adminDb.runTransaction(async (txn) => {
      const [latestTx, latestAffiliate] = await Promise.all([txn.get(txRef), txn.get(affRef)]);
      if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Déjà traitée.');
      if (latestTx.data()!.affiliateId !== affiliateId) throw new Error('Accès refusé.');
      if (!latestAffiliate.exists || (latestAffiliate.data()!.balance || 0) < amount) {
        throw new Error('Solde affilié insuffisant pour confirmer ce dépôt.');
      }
      txn.update(affRef, { balance: FieldValue.increment(-(amount - affiliateShare)), updatedAt: now });
      txn.update(clientRef, { balance: FieldValue.increment(netToClient), updatedAt: now });
      txn.update(txRef, { status: 'approved', updatedAt: now, confirmedAt: now,
        ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare, adminFeeShare: adminShare }) });
      if (adminShare > 0) txn.update(adminDb.collection('settings').doc('global'), {
        feesBalance: FieldValue.increment(adminShare), updatedAt: now,
      });
      txn.set(adminDb.collection('affiliate_transactions').doc(), {
        affiliateId, type: 'client_deposit_given', amount,
        clientId: txData.clientId, clientName: txData.clientName || '',
        description: `Dépôt confirmé pour ${txData.clientName}`, status: 'completed',
        ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare }), createdAt: now,
      });
    });

    // Email to client + admin: affiliate confirmed deposit
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: affData.name || '', clientName: txData.clientName || '', clientEmail, type: 'deposit', action: 'confirmed', amount: txData.amount }),
        { type: 'affiliate_deposit_confirmed_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount: txData.amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[affiliate/client-deposit/confirm]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Affiliate: reject client deposit request ───────────────────────────────────
router.post('/api/affiliate/client-deposit/:txId/reject', requireDb, async (req, res) => {
  try {
    const { txId } = req.params;
    const { affiliateId, reason } = req.body;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.affiliateId !== affiliateId) return res.status(403).json({ error: 'Non autorisé.' });
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Déjà traitée.' });

    const affSnapDepRej = await adminDb.collection('affiliates').doc(affiliateId).get();
    const affNameDepRej = affSnapDepRej.exists ? (affSnapDepRej.data()?.name || '') : '';
    const now = FieldValue.serverTimestamp();
    await transitionPending(txRef, { status: 'rejected', updatedAt: now, rejectionReason: reason || '' });

    // Email to client + admin: affiliate rejected deposit
    adminDb.collection('clients').doc(txData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      const amount = Number(txData.amount || 0);
      fireEmail(
        () => emailAgentProcessed({ agentName: affNameDepRej, clientName: txData.clientName || '', clientEmail, type: 'deposit', action: 'rejected', amount, reason }),
        { type: 'affiliate_deposit_rejected_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: txData.clientId, amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/affiliate/submit-client-deposit', requireDb, async (req, res) => {
  try {
    const { affiliateId, clientWalletId, amount, method } = req.body;
    if (!affiliateId || !clientWalletId || !amount || !method)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });
    const affiliateSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affiliateSnap.exists)
      return res.status(404).json({ error: 'Affilié introuvable.' });
    const affiliateData = affiliateSnap.data()!;
    const clientSnap = await adminDb.collection('clients')
      .where('walletId', '==', clientWalletId.trim()).limit(1).get();
    if (clientSnap.empty)
      return res.status(404).json({ error: 'Aucun client trouvé avec cet ID Wallet.' });
    const clientDoc = clientSnap.docs[0];
    const clientData = clientDoc.data();
    await adminDb.collection('client_requests').add({
      type: 'deposit',
      clientId: clientDoc.id,
      clientName: clientData.name || '',
      clientWalletId: clientWalletId.trim(),
      amount: usd,
      method,
      status: 'pending',
      source: 'affiliate',
      affiliateId,
      affiliateName: affiliateData.name || '',
      affiliateCode: affiliateData.code || '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, clientName: clientData.name || '' });
  } catch (e: any) {
    console.error('[affiliate/submit-client-deposit]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Affiliate: submit own deposit request (with walletType) ──────────────────
router.post('/api/affiliate/submit-deposit', requireDb, async (req, res) => {
  try {
    const { affiliateId, amount, method, walletType, pin } = req.body;
    if (!affiliateId || !amount || !method)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    if (!affData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), affData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });
    const isCommissions = walletType === 'commissions';
    const walletLabel = isCommissions ? 'Wallet Commissions' : 'Wallet Principal';

    const txRef = adminDb.collection('wallet_transactions').doc();
    await txRef.set({
      affiliateId,
      affiliateName: affData.name || '',
      type: 'deposit',
      amount: usd,
      status: 'pending',
      method,
      walletType: walletType || 'principal',
      walletLabel,
      description: `Demande de dépôt — ${walletLabel} — via ${method}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('[affiliate/submit-deposit]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Affiliate: submit own withdrawal (personal) ───────────────────────────────
router.post('/api/affiliate/submit-withdrawal', requireDb, async (req, res) => {
  try {
    const { affiliateId, amount, method, accountNumber, walletType, pin } = req.body;
    if (!affiliateId || !amount || !method || !accountNumber)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    if (!affData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), affData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });
    const isCommissions = walletType === 'commissions';
    const walletField = isCommissions ? 'totalEarnings' : 'balance';
    const withdrawRef = adminDb.collection('withdrawals').doc();
    const walletLabel = isCommissions ? 'Wallet Commissions' : 'Wallet Principal';
    const txRef = adminDb.collection('wallet_transactions').doc();
    await adminDb.runTransaction(async (txn) => {
      const latestAffiliate = await txn.get(affSnap.ref);
      if (!latestAffiliate.exists) throw new Error('Affilié introuvable.');
      const latestData = latestAffiliate.data()!;
      const walletBalance = Number(latestData[walletField] || 0);
      if (walletBalance < usd) throw new Error(`Solde insuffisant. Disponible: $${walletBalance.toFixed(2)}`);
      txn.set(withdrawRef, {
        affiliateId, affiliateName: latestData.name || '', affiliateCode: latestData.code || '',
        amount: usd, method, accountNumber, walletType: walletType || 'principal', walletLabel,
        status: 'pending', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(txRef, {
        affiliateId, type: 'withdrawal', amount: usd, status: 'pending', method, accountNumber,
        walletType: walletType || 'principal', description: `Retrait ${walletLabel} via ${method}`,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.update(affSnap.ref, {
        [walletField]: FieldValue.increment(-usd),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    pushAllAdminsEvent('new_notification', {
      type: 'affiliate_withdrawal_submitted',
      affiliateId,
      affiliateName: affData.name || '',
      amount: usd,
      method,
      read: false,
      createdAt: { _seconds: Date.now() / 1000 },
    });

    // Email to admin + affiliate
    fireEmail(
      () => emailAffiliateWithdrawalSubmitted({
        affiliateName: affData.name || '',
        affiliateEmail: affData.email || undefined,
        amount: usd,
        method,
        accountNumber,
      }),
      { type: 'affiliate_withdrawal_submitted', to: [ADMIN_EMAIL, ...(affData.email ? [affData.email] : [])], clientId: affiliateId, amount: usd }
    );

    res.json({ success: true });
  } catch (e: any) {
    console.error('[affiliate/submit-withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Delete client transaction history ────────────────────────────────────────
router.delete('/api/client/transactions/:clientId', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (!clientId) return res.status(400).json({ error: 'clientId requis.' });
    const snap = await adminDb.collection('client_transactions')
      .where('clientId', '==', clientId).limit(200).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, deleted: snap.size });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Wallet Stats ───────────────────────────────────────────────────────
router.get('/api/admin/wallet/stats', requireDb, async (req, res) => {
  try {
    const [txSnap, clientsSnap] = await Promise.all([
      adminDb.collection('client_transactions').orderBy('createdAt', 'desc').limit(500).get(),
      adminDb.collection('clients').get(),
    ]);
    const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    const clients = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    const sum = (arr: any[], field: string) => arr.reduce((s, t) => s + (t[field] || t.amount || 0), 0);
    const approved = (type: string) => txs.filter(t => t.type === type && (t.status === 'approved' || t.status === 'completed'));

    res.json({
      totalDeposited: sum(approved('deposit'), 'usdAmount'),
      totalWithdrawn: sum(approved('withdrawal'), 'usdAmount'),
      totalSpent: sum(approved('purchase'), 'usdAmount'),
      totalBalance: clients.reduce((s: number, c: any) => s + (c.balance || 0), 0),
      activeWallets: clients.filter((c: any) => (c.balance || 0) > 0).length,
      totalClients: clients.length,
      pendingDeposits: txs.filter(t => t.type === 'deposit' && t.status === 'pending').length,
      pendingWithdrawals: txs.filter(t => t.type === 'withdrawal' && t.status === 'pending').length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: atomic affiliate wallet credit ─────────────────────────────────────
router.post('/api/admin/affiliate/credit', requireDb, async (req, res) => {
  try {
    const { affiliateId, amount, description } = req.body;
    const credit = Number(amount);
    if (!affiliateId || !Number.isFinite(credit) || credit === 0) {
      return res.status(400).json({ error: 'Crédit invalide.' });
    }
    await adminDb.runTransaction(async (tx) => {
      const affiliateRef = adminDb.collection('affiliates').doc(affiliateId);
      const affiliate = await tx.get(affiliateRef);
      if (!affiliate.exists) throw new Error('Affilié introuvable.');
      const current = Number(affiliate.data()?.balance || 0);
      const next = current + credit;
      if (next < 0) throw new Error('Solde insuffisant.');
      tx.update(affiliateRef, {
        balance: next,
        totalEarnings: Number(affiliate.data()?.totalEarnings || 0) + (credit > 0 ? credit : 0),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const transactionRef = adminDb.collection('wallet_transactions').doc();
      tx.set(transactionRef, {
        affiliateId,
        type: credit > 0 ? 'deposit' : 'adjustment',
        amount: Math.abs(credit),
        status: 'completed',
        description: String(description || 'Ajustement administrateur').slice(0, 500),
        adminId: res.locals.adminSession.adminId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Impossible de créditer ce compte.' });
  }
});

// ── Helper: auto-trigger affiliate commissions (server-side) ─────────────────
async function triggerAffiliateCommissions(
  directAffiliateId: string,
  type: 'purchase' | 'subscription' | 'virtual_card',
  itemName?: string,
  transactionAmountUSD?: number,  // used when commissionMode === 'percentage'
  serviceCommissionRate?: number  // % du prix défini par service dans le catalogue
) {
  try {
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const settings = settingsSnap.exists ? settingsSnap.data()! : {};
    const exchangeRate = settings.exchangeRate || 146;
    const commissionMode = settings.commissionMode || 'fixed';

    const isStreaming = itemName && ['netflix','prime','paramount','disney','hbo','iptv','spotify','video','streaming']
      .some(k => (itemName || '').toLowerCase().includes(k));

    let directUSD: number, parentUSD: number, grandparentUSD: number;
    let directHTG: number, parentHTG: number, grandparentHTG: number, pointsEarned: number;

    // ── Taux par service (prioritaire sur les taux globaux) ───────────────────
    if (serviceCommissionRate !== undefined && serviceCommissionRate > 0 && transactionAmountUSD && transactionAmountUSD > 0) {
      directUSD      = parseFloat((transactionAmountUSD * serviceCommissionRate / 100).toFixed(4));
      // Le parent reçoit 25% de ce que touche le direct (configurable via commissionParentSharePct)
      const parentSharePct = settings.commissionParentSharePct ?? 25;
      // Le grand-parent reçoit 12% de ce que touche le direct (configurable via commissionGpSharePct)
      const gpSharePct     = settings.commissionGpSharePct     ?? 12;
      parentUSD      = parseFloat((directUSD * parentSharePct / 100).toFixed(4));
      grandparentUSD = parseFloat((directUSD * gpSharePct     / 100).toFixed(4));
      directHTG      = parseFloat((directUSD      * exchangeRate).toFixed(2));
      parentHTG      = parseFloat((parentUSD      * exchangeRate).toFixed(2));
      grandparentHTG = parseFloat((grandparentUSD * exchangeRate).toFixed(2));
      pointsEarned   = type === 'virtual_card' ? 25 : (isStreaming ? 5 : type === 'subscription' ? 10 : 1);
    } else if (commissionMode === 'percentage' && transactionAmountUSD && transactionAmountUSD > 0) {
      // ── Percentage of transaction amount ──
      let dPct: number, pPct: number, gpPct: number;
      if (type === 'virtual_card') {
        dPct  = settings.commissionVirtualCardPct       || 0;
        pPct  = settings.commissionVirtualCardParentPct || 0;
        gpPct = settings.commissionVirtualCardGpPct     || 0;
        pointsEarned = 25;
      } else if (type === 'subscription') {
        dPct  = settings.commissionSubscriptionPct       || 0;
        pPct  = settings.commissionSubscriptionParentPct || 0;
        gpPct = settings.commissionSubscriptionGpPct     || 0;
        pointsEarned = isStreaming ? 5 : 10;
      } else {
        dPct  = settings.commissionPurchasePct       || 0;
        pPct  = settings.commissionPurchaseParentPct || 0;
        gpPct = settings.commissionPurchaseGpPct     || 0;
        pointsEarned = 1;
      }
      directUSD      = parseFloat((transactionAmountUSD * dPct  / 100).toFixed(4));
      parentUSD      = parseFloat((transactionAmountUSD * pPct  / 100).toFixed(4));
      grandparentUSD = parseFloat((transactionAmountUSD * gpPct / 100).toFixed(4));
      // HTG display equivalents
      directHTG      = parseFloat((directUSD      * exchangeRate).toFixed(2));
      parentHTG      = parseFloat((parentUSD      * exchangeRate).toFixed(2));
      grandparentHTG = parseFloat((grandparentUSD * exchangeRate).toFixed(2));
    } else {
      // ── Fixed HTG amounts (legacy/default) ──
      if (type === 'virtual_card') {
        directHTG     = settings.commissionVirtualCardHTG        || 350;
        parentHTG     = settings.commissionVirtualCardParentHTG  || 40;
        grandparentHTG= settings.commissionVirtualCardGpHTG      || 10;
        pointsEarned  = 25;
      } else if (type === 'subscription') {
        directHTG     = settings.commissionSubscriptionHTG        || 75;
        parentHTG     = settings.commissionSubscriptionParentHTG  || 15;
        grandparentHTG= settings.commissionSubscriptionGpHTG      || 10;
        pointsEarned  = isStreaming ? 5 : 10;
      } else {
        directHTG     = settings.commissionPurchaseHTG        || 2;
        parentHTG     = settings.commissionPurchaseParentHTG  || 0.5;
        grandparentHTG= settings.commissionPurchaseGpHTG      || 0.5;
        pointsEarned  = 1;
      }
      directUSD      = directHTG      / exchangeRate;
      parentUSD      = parentHTG      / exchangeRate;
      grandparentUSD = grandparentHTG / exchangeRate;
    }

    const affRef  = adminDb.collection('affiliates').doc(directAffiliateId);
    const affSnap = await affRef.get();
    if (!affSnap.exists) return;
    const aff = affSnap.data()!;

    // Collecter les données parent/grand-parent pour emails après commit
    let parentData: { name: string; email?: string } | null = null;
    let gpData:     { name: string; email?: string } | null = null;

    const batch = adminDb.batch();

    batch.update(affRef, {
      balance:       FieldValue.increment(directUSD),
      directRevenue: FieldValue.increment(directUSD),
      totalEarnings: FieldValue.increment(directUSD),
      points:        FieldValue.increment(pointsEarned),
      monthlySales:  FieldValue.increment(1),
      updatedAt:     FieldValue.serverTimestamp(),
    });

    const saleRef = adminDb.collection('sales').doc();
    batch.set(saleRef, {
      affiliateId: directAffiliateId, affiliateName: aff.name,
      type, itemName: itemName || (type === 'virtual_card' ? 'Carte MasterCard' : 'Produit'),
      commission: directUSD, commissionHTG: directHTG,
      points: pointsEarned, createdAt: FieldValue.serverTimestamp(),
    });

    const n1 = adminDb.collection('notifications').doc();
    batch.set(n1, {
      affiliateId: directAffiliateId,
      title: 'Nouvelle Vente !',
      message: `Félicitations ! Vous avez gagné ${directHTG} Goud et ${pointsEarned} points sur "${itemName || 'une vente'}".`,
      type: 'revenue', read: false, createdAt: FieldValue.serverTimestamp(),
    });

    if (aff.parentAffiliateId) {
      const parentRef  = adminDb.collection('affiliates').doc(aff.parentAffiliateId);
      const parentSnap = await parentRef.get();
      if (parentSnap.exists) {
        const pd = parentSnap.data()!;
        parentData = { name: pd.name, email: pd.email };
        batch.update(parentRef, {
          balance: FieldValue.increment(parentUSD), indirectRevenue: FieldValue.increment(parentUSD),
          totalEarnings: FieldValue.increment(parentUSD), updatedAt: FieldValue.serverTimestamp(),
        });
        const n2 = adminDb.collection('notifications').doc();
        batch.set(n2, {
          affiliateId: aff.parentAffiliateId, title: 'Commission Directe (Filleul)',
          message: `Niveau 1: Vous avez reçu ${parentHTG} Goud (~${parentUSD.toFixed(2)} $) suite à une vente de ${aff.name}.`,
          type: 'revenue', read: false, createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    if (aff.grandparentAffiliateId) {
      const gpRef  = adminDb.collection('affiliates').doc(aff.grandparentAffiliateId);
      const gpSnap = await gpRef.get();
      if (gpSnap.exists) {
        const gd = gpSnap.data()!;
        gpData = { name: gd.name, email: gd.email };
        batch.update(gpRef, {
          balance: FieldValue.increment(grandparentUSD), indirectRevenue: FieldValue.increment(grandparentUSD),
          totalEarnings: FieldValue.increment(grandparentUSD), updatedAt: FieldValue.serverTimestamp(),
        });
        const n3 = adminDb.collection('notifications').doc();
        batch.set(n3, {
          affiliateId: aff.grandparentAffiliateId, title: 'Commission Indirecte (Filleul N2)',
          message: `Niveau 2: Vous avez reçu ${grandparentHTG} Goud (~${grandparentUSD.toFixed(2)} $) via l'affilié ${aff.name}.`,
          type: 'revenue', read: false, createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    console.log(`[Commission] ✓ Auto-attribuée à ${aff.name} (${type}) — direct: ${directHTG} HTG`);

    // ── Emails de commission (fire-and-forget après commit) ───────────────────
    const serviceName = itemName || (type === 'virtual_card' ? 'Carte MasterCard' : 'Service');

    // Direct
    if (aff.email) {
      fireEmail(
        () => emailAffiliateCommission({
          affiliateName: aff.name,
          affiliateEmail: aff.email,
          amount: directHTG,
          sourceClientName: serviceName,
          type: 'Commission directe (filleul)',
        }),
        { type: 'affiliate_commission_direct', to: aff.email, amount: directHTG },
      );
    }
    // Parent (niveau 1 indirect)
    if (parentData?.email) {
      fireEmail(
        () => emailAffiliateCommission({
          affiliateName: parentData!.name,
          affiliateEmail: parentData!.email,
          amount: parentHTG,
          sourceClientName: `${aff.name} (filleul de votre filleul)`,
          type: 'Commission Niveau 1',
        }),
        { type: 'affiliate_commission_parent', to: parentData.email, amount: parentHTG },
      );
    }
    // Grand-parent (niveau 2 indirect)
    if (gpData?.email) {
      fireEmail(
        () => emailAffiliateCommission({
          affiliateName: gpData!.name,
          affiliateEmail: gpData!.email,
          amount: grandparentHTG,
          sourceClientName: `${aff.name} (réseau indirect)`,
          type: 'Commission Niveau 2',
        }),
        { type: 'affiliate_commission_grandparent', to: gpData.email, amount: grandparentHTG },
      );
    }
  } catch (e: any) {
    console.error('[Commission] Erreur auto-commission:', e?.message);
  }
}

// ── Manual commission route (admin) ──────────────────────────────────────────
router.post('/api/admin/affiliate/manual-commission', requireDb, async (req, res) => {
  try {
    const { affiliateId, amountHTG, reason } = req.body;
    if (!affiliateId || !amountHTG) return res.status(400).json({ error: 'Paramètres manquants.' });

    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const exchangeRate = settingsSnap.exists ? (settingsSnap.data()!.exchangeRate || 146) : 146;
    const amountUSD = Number(amountHTG) / exchangeRate;

    const affRef  = adminDb.collection('affiliates').doc(affiliateId);
    const notifRef = adminDb.collection('notifications').doc();
    const operationId = res.locals.financialOperationId as string | undefined;
    const operationRef = operationId ? adminDb.collection('financial_operations').doc(operationId) : null;
    await adminDb.runTransaction(async (txn) => {
      const reads = [txn.get(affRef)];
      if (operationRef) reads.push(txn.get(operationRef));
      const [affSnap, existingOperation] = await Promise.all(reads);
      if (!affSnap.exists) throw new Error('Affilié introuvable.');
      if (existingOperation?.exists) throw new Error('Cette demande a déjà été reçue.');
      txn.update(affRef, {
        balance: FieldValue.increment(amountUSD), totalEarnings: FieldValue.increment(amountUSD),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(notifRef, {
        affiliateId, title: 'Commission Manuelle',
        message: `Vous avez reçu une commission manuelle de ${amountHTG} Goud (~${amountUSD.toFixed(2)} $)${reason ? ` — ${reason}` : ''}.`,
        type: 'revenue', read: false, createdAt: FieldValue.serverTimestamp(),
      });
      if (operationRef) txn.set(operationRef, {
        type: 'affiliate_manual_commission', targetId: affiliateId,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, amountUSD: amountUSD.toFixed(4) });
  } catch (e: any) {
    console.error('[manual-commission]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Purchase ──────────────────────────────────────────────────────────────────
router.post('/api/client/purchase', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, clientPhone, clientWalletId, amount, productName, productPrice, directSponsorId, serviceCommissionRate } = req.body;
    if (!clientId || !clientName || !amount || !productName)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    if (amount <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const txRef = adminDb.collection('client_transactions').doc();
    const notifRef = adminDb.collection('admin_notifications').doc();
    let clientEmail = '';
    await adminDb.runTransaction(async (txn) => {
      const clientSnap = await txn.get(clientRef);
      if (!clientSnap.exists) throw new Error('Client introuvable.');
      const clientData = clientSnap.data()!;
      const currentBalance = Number(clientData.balance || 0);
      if (currentBalance < amount) throw new Error('Solde insuffisant pour cet achat.');
      clientEmail = clientData.email || '';
      txn.update(clientRef, {
        balance: FieldValue.increment(-Number(amount)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(txRef, {
        clientId, clientName, type: 'purchase', amount, status: 'completed',
        productName, productPrice, directSponsorId: directSponsorId || null,
        affiliateCredited: !!directSponsorId,
        description: `Achat: ${productName} - ${productPrice}`,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(notifRef, {
        type: 'client_purchase', clientId, clientName,
        clientPhone: clientPhone || '', clientWalletId: clientWalletId || '',
        transactionId: txRef.id, amount, productName, productPrice,
        directSponsorId: directSponsorId || null, commissionAutoSent: !!directSponsorId,
        status: 'completed', read: false, createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Auto-trigger commissions for the affiliate chain (fire-and-forget)
    if (directSponsorId) {
      triggerAffiliateCommissions(directSponsorId, 'purchase', productName, amount, serviceCommissionRate ?? undefined).catch(() => {});
    }

    sendFcmToClient(
      clientId,
      '✅ Achat enregistré',
      `Votre achat de ${productName} a été enregistré avec succès.`,
      { type: 'purchase', txId: txRef.id }
    );

    // Email admin + client
    fireEmail(
      () => emailPurchase({ clientName, clientEmail, productName, amount }),
      { type: 'purchase', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId, amount }
    );

    res.json({ success: true, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[purchase]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.post('/api/admin/purchase/approve', requireDb, async (req, res) => {
  try {
    const { notifId, transactionId, clientId, credentials, productName } = req.body;
    if (!notifId || !transactionId)
      return res.status(400).json({ error: 'Paramètres manquants.' });

    const batch = adminDb.batch();
    batch.update(adminDb.collection('client_transactions').doc(transactionId), {
      status: 'completed', updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(adminDb.collection('admin_notifications').doc(notifId), {
      status: 'approved', read: true, resolvedAt: FieldValue.serverTimestamp(),
    });

    // If credentials provided, create a dedicated client notification
    const hasCredentials = credentials?.email && credentials?.password;
    if (clientId && hasCredentials) {
      const credNotifRef = adminDb.collection('client_notifications').doc();
      batch.set(credNotifRef, {
        clientId,
        type: 'purchase_credentials',
        title: `🔑 Accès ${productName || 'Service'}`,
        message: `Voici vos identifiants de connexion pour ${productName || 'votre service'}.`,
        metadata: {
          credentialEmail: credentials.email,
          credentialPassword: credentials.password,
          productName: productName || '',
        },
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Also create a standard approval notification
    if (clientId) {
      const stdNotifRef = adminDb.collection('client_notifications').doc();
      batch.set(stdNotifRef, {
        clientId,
        type: 'purchase',
        title: '✅ Service activé',
        message: hasCredentials
          ? `Votre service ${productName || ''} est activé. Consultez vos identifiants dans vos notifications.`
          : `Votre service ${productName || ''} a été traité avec succès. Merci pour votre confiance !`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    if (clientId) {
      sendFcmToClient(
        clientId,
        '✅ Service activé',
        hasCredentials ? `Vos identifiants pour ${productName || 'votre service'} sont disponibles.` : 'Votre service a été traité avec succès.',
        { type: 'purchase_approved', txId: transactionId }
      );

      // Send email with credentials if client has email
      if (hasCredentials) {
        const clientSnap = await adminDb.collection('clients').doc(clientId).get();
        const clientEmail = clientSnap.data()?.email;
        if (clientEmail) {
          fireEmail(
            () => emailServiceCredentials({ clientEmail, productName: productName || 'Service', credentialEmail: credentials.email, credentialPassword: credentials.password }),
            { type: 'service_credentials', to: [clientEmail], clientId }
          );
        }
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[purchase/approve]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.post('/api/admin/purchase/decline', requireDb, async (req, res) => {
  try {
    const { notifId, transactionId } = req.body;
    if (!notifId || !transactionId)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const batch = adminDb.batch();
    batch.update(adminDb.collection('client_transactions').doc(transactionId), {
      status: 'rejected', updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(adminDb.collection('admin_notifications').doc(notifId), {
      status: 'declined', read: true, resolvedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    adminDb.collection('client_transactions').doc(transactionId).get()
      .then(snap => {
        if (snap.exists) {
          sendFcmToClient(
            snap.data()!.clientId,
            '❌ Achat refusé',
            'Votre demande d\'achat a été refusée. Contactez le support pour plus d\'informations.',
            { type: 'purchase_declined', txId: transactionId }
          );
        }
      }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[purchase/decline]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Promo Codes ───────────────────────────────────────────────────────────────
router.get('/api/promo-codes', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('promo_codes').orderBy('createdAt', 'desc').get();
    res.json({ codes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/promo-codes', requireDb, async (req, res) => {
  try {
    const { code, serviceName, discountPercent, maxUses, active } = req.body;
    if (!code || discountPercent == null) return res.status(400).json({ error: 'code et discountPercent requis.' });
    // Check uniqueness
    const existing = await adminDb.collection('promo_codes').where('code', '==', code.toUpperCase().trim()).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: 'Ce code existe déjà.' });
    const ref = await adminDb.collection('promo_codes').add({
      code: code.toUpperCase().trim(),
      serviceName: serviceName || '',
      discountPercent: Number(discountPercent),
      maxUses: Number(maxUses) || 0,
      usedCount: 0,
      active: active !== false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/promo-codes/:id', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, serviceName, discountPercent, maxUses, active } = req.body;
    const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (code !== undefined) updates.code = code.toUpperCase().trim();
    if (serviceName !== undefined) updates.serviceName = serviceName;
    if (discountPercent !== undefined) updates.discountPercent = Number(discountPercent);
    if (maxUses !== undefined) updates.maxUses = Number(maxUses);
    if (active !== undefined) updates.active = active;
    await adminDb.collection('promo_codes').doc(id).update(updates);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/promo-codes/:id', requireDb, async (req, res) => {
  try {
    await adminDb.collection('promo_codes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Validate a promo code for a given service (client-facing)
router.post('/api/promo-codes/validate', requireDb, async (req, res) => {
  try {
    const { code, serviceName, userId } = req.body;
    if (!code) return res.status(400).json({ error: 'Code requis.' });
    const snap = await adminDb.collection('promo_codes')
      .where('code', '==', code.toUpperCase().trim())
      .where('active', '==', true)
      .limit(1).get();
    if (snap.empty) return res.json({ valid: false, error: 'Code introuvable ou inactif.' });
    const doc = snap.docs[0];
    const data = doc.data();

    // SECURITY: Check validity period
    const now = new Date();
    if (data.dateStart) {
      const start = data.dateStart?.toDate ? data.dateStart.toDate() : new Date(data.dateStart);
      if (now < start) return res.json({ valid: false, error: 'Ce code n\'est pas encore actif.' });
    }
    if (data.dateEnd) {
      const end = data.dateEnd?.toDate ? data.dateEnd.toDate() : new Date(data.dateEnd);
      if (now > end) return res.json({ valid: false, error: 'Ce code a expiré.' });
    }

    // Check service match (empty = all services)
    if (data.serviceName && serviceName && !serviceName.toLowerCase().includes(data.serviceName.toLowerCase())) {
      return res.json({ valid: false, error: `Ce code est valable uniquement pour ${data.serviceName}.` });
    }
    // SECURITY: Check max global uses
    if (data.maxUses > 0 && (data.usedCount || 0) >= data.maxUses) {
      return res.json({ valid: false, error: 'Ce code a atteint sa limite d\'utilisation.' });
    }
    // SECURITY: Check per-user usage if the code has a per-user limit
    if (userId && (data.maxUsesPerUser || 0) > 0) {
      const userUsageSnap = await adminDb.collection('promo_code_usages')
        .where('codeId', '==', doc.id)
        .where('userId', '==', userId)
        .limit(1).get();
      if (!userUsageSnap.empty && (userUsageSnap.docs[0].data().count || 0) >= data.maxUsesPerUser) {
        return res.json({ valid: false, error: 'Vous avez déjà utilisé ce code le nombre maximum de fois autorisé.' });
      }
    }
    // SECURITY: Check single-use-per-user codes (onePerUser flag)
    if (userId && data.onePerUser) {
      const usedSnap = await adminDb.collection('promo_code_usages')
        .where('codeId', '==', doc.id)
        .where('userId', '==', userId)
        .limit(1).get();
      if (!usedSnap.empty) {
        return res.json({ valid: false, error: 'Vous avez déjà utilisé ce code.' });
      }
    }

    res.json({ valid: true, id: doc.id, discountPercent: data.discountPercent, serviceName: data.serviceName });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// SECURITY: Atomically validate + increment usage after a purchase with promo code.
// Runs inside a Firestore transaction to prevent concurrent double-use of the last available slot.
router.post('/api/promo-codes/:id/use', requireDb, async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    const codeId = req.params.id;
    const codeRef = adminDb.collection('promo_codes').doc(codeId);

    await adminDb.runTransaction(async (txn) => {
      const codeSnap = await txn.get(codeRef);
      if (!codeSnap.exists) throw new Error('Code promo introuvable.');
      const data = codeSnap.data()!;
      if (!data.active) throw new Error('Ce code promo n\'est plus actif.');

      // Re-verify expiry inside transaction
      const now = new Date();
      if (data.dateEnd) {
        const end = data.dateEnd?.toDate ? data.dateEnd.toDate() : new Date(data.dateEnd);
        if (now > end) throw new Error('Ce code promo a expiré.');
      }
      // Re-verify max uses inside transaction (prevents race condition on last slot)
      if (data.maxUses > 0 && (data.usedCount || 0) >= data.maxUses) {
        throw new Error('Ce code a atteint sa limite d\'utilisation.');
      }

      // Increment global usage counter
      txn.update(codeRef, { usedCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });

      // Record per-user usage for future per-user limit checks
      if (userId) {
        const usageRef = adminDb.collection('promo_code_usages').doc(`${codeId}_${userId}`);
        txn.set(usageRef, {
          codeId, userId, code: data.code,
          ...(orderId && { orderId }),
          count: FieldValue.increment(1),
          lastUsedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });

    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ── Admin: affiliate withdrawal approve / reject ───────────────────────────────
router.post('/api/admin/withdrawal/:id/approve', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id } = req.params;
    const requestRef = adminDb.collection('withdrawals').doc(id);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const requestData = requestSnap.data()!;
    if (requestData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    // Sync the linked wallet_transaction if one exists
    const snapTx = await adminDb.collection('wallet_transactions')
      .where('affiliateId', '==', requestData.affiliateId)
      .where('type', '==', 'withdrawal')
      .where('amount', '==', requestData.amount)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    const affiliateRef = adminDb.collection('affiliates').doc(requestData.affiliateId);
    const notifData = {
      affiliateId: requestData.affiliateId,
      title: '✅ Retrait approuvé',
      message: `Votre demande de retrait de $${requestData.amount} a été approuvée. Vous serez payé sur ${requestData.method} dans les plus brefs délais.`,
      type: 'withdrawal_approved',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    const notifRef = adminDb.collection('affiliate_notifications').doc();
    await adminDb.runTransaction(async (txn) => {
      const latestRequest = await txn.get(requestRef);
      if (!latestRequest.exists || latestRequest.data()!.status !== 'pending') throw new Error('Demande déjà traitée.');
      if (latestRequest.data()!.affiliateId !== requestData.affiliateId) throw new Error('Accès refusé.');
      txn.update(requestRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });
      if (!snapTx.empty) txn.update(snapTx.docs[0].ref, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });
      txn.update(affiliateRef, {
        totalWithdrawn: FieldValue.increment(requestData.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(notifRef, notifData);
    });

    // Real-time: SSE + FCM (fire-and-forget)
    const ssePayload = { id: notifRef.id, ...notifData, createdAt: { _seconds: Date.now() / 1000 } };
    pushRoleEvent('affiliate', requestData.affiliateId, 'new_notification', ssePayload);
    sendFcmToRole('affiliate', requestData.affiliateId, notifData.title, notifData.message).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[admin/withdrawal/approve]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.post('/api/admin/withdrawal/:id/reject', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const requestRef = adminDb.collection('withdrawals').doc(id);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const requestData = requestSnap.data()!;
    if (requestData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    // Sync the linked wallet_transaction if one exists
    const snapTx = await adminDb.collection('wallet_transactions')
      .where('affiliateId', '==', requestData.affiliateId)
      .where('type', '==', 'withdrawal')
      .where('amount', '==', requestData.amount)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    // Refund affiliate balance (was deducted on submission)
    const walletRefField = requestData.walletType === 'commissions' ? 'totalEarnings' : 'balance';
    const affiliateRefReject = adminDb.collection('affiliates').doc(requestData.affiliateId);
    const rejectNotifData = {
      affiliateId: requestData.affiliateId,
      title: '❌ Retrait refusé',
      message: `Votre demande de retrait de ${requestData.amount} a été refusée.${reason ? ` Raison : ${reason}` : ''}`,
      type: 'withdrawal_rejected',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    const rejectNotifRef = adminDb.collection('affiliate_notifications').doc();
    await adminDb.runTransaction(async (txn) => {
      const latestRequest = await txn.get(requestRef);
      if (!latestRequest.exists || latestRequest.data()!.status !== 'pending') throw new Error('Demande déjà traitée.');
      if (latestRequest.data()!.affiliateId !== requestData.affiliateId) throw new Error('Accès refusé.');
      txn.update(requestRef, {
        status: 'rejected',
        rejectionReason: reason || '',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (!snapTx.empty) txn.update(snapTx.docs[0].ref, { status: 'rejected', updatedAt: FieldValue.serverTimestamp() });
      txn.update(affiliateRefReject, {
        [walletRefField]: FieldValue.increment(requestData.amount),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(rejectNotifRef, rejectNotifData);
    });

    // Real-time: SSE + FCM (fire-and-forget)
    const rejectSsePayload = { id: rejectNotifRef.id, ...rejectNotifData, createdAt: { _seconds: Date.now() / 1000 } };
    pushRoleEvent('affiliate', requestData.affiliateId, 'new_notification', rejectSsePayload);
    sendFcmToRole('affiliate', requestData.affiliateId, rejectNotifData.title, rejectNotifData.message).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    console.error('[admin/withdrawal/reject]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Transaction status (deposits & withdrawals) ───────────────────────────────
router.post('/api/admin/transaction/status', requireDb, async (req, res) => {
  try {
    const { txId, status, reason } = req.body;
    if (!txId || !status) return res.status(400).json({ error: 'Paramètres manquants.' });

    const txRef = adminDb.collection('client_transactions').doc(txId);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });

    const clientRef = adminDb.collection('clients').doc(txData.clientId);
    await adminDb.runTransaction(async (batch) => {
    const [latestTx, clientSnap] = await Promise.all([batch.get(txRef), batch.get(clientRef)]);
    if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Transaction déjà traitée.');
    batch.update(txRef, {
      status,
      ...(reason && { rejectionReason: reason }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (clientSnap.exists) {
      if (status === 'approved' && txData.type === 'deposit') {
        // Apply deposit fee and split between admin + referring affiliate
        let netAmount = txData.amount;
        try {
          const settingsSnap = await adminDb.collection('settings').doc('global').get();
          const sData = settingsSnap.exists ? settingsSnap.data()! : {};
          const feePercent = sData.depositFeePercent || 0;
          const affiliateSharePct = sData.affiliateDepositFeeSharePercent || 0;
          if (feePercent > 0) {
            const feeAmount = parseFloat((txData.amount * feePercent / 100).toFixed(4));
            if (feeAmount > 0) {
              netAmount = txData.amount - feeAmount;
              const affiliateShare = parseFloat((feeAmount * affiliateSharePct / 100).toFixed(4));
              const adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));
              if (adminShare > 0) {
                batch.update(adminDb.collection('settings').doc('global'), {
                  feesBalance: FieldValue.increment(adminShare),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }
              // Credit referring affiliate's share → commissionBalance
              if (affiliateShare > 0) {
                const sponsorId = clientSnap.data()!.directSponsorId as string | undefined;
                if (sponsorId) {
                  batch.update(adminDb.collection('affiliates').doc(sponsorId), {
                    commissionBalance: FieldValue.increment(affiliateShare),
                    totalEarnings: FieldValue.increment(affiliateShare),
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                }
              }
            }
          }
        } catch {}
        batch.update(clientRef, {
          balance: FieldValue.increment(netAmount),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (status === 'approved' && txData.type === 'withdrawal') {
        // Apply withdrawal fee and split between admin + referring affiliate
        try {
          const settingsSnap = await adminDb.collection('settings').doc('global').get();
          const sData = settingsSnap.exists ? settingsSnap.data()! : {};
          const feePercent = sData.withdrawalFeePercent || 0;
          const affiliateSharePct = sData.affiliateWithdrawalFeeSharePercent || 0;
          if (feePercent > 0) {
            const feeAmount = parseFloat((txData.amount * feePercent / 100).toFixed(4));
            if (feeAmount > 0) {
              const affiliateShare = parseFloat((feeAmount * affiliateSharePct / 100).toFixed(4));
              const adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));
              if (adminShare > 0) {
                batch.update(adminDb.collection('settings').doc('global'), {
                  feesBalance: FieldValue.increment(adminShare),
                  updatedAt: FieldValue.serverTimestamp(),
                });
              }
              if (affiliateShare > 0) {
                const sponsorId = clientSnap.data()!.directSponsorId as string | undefined;
                if (sponsorId) {
                  batch.update(adminDb.collection('affiliates').doc(sponsorId), {
                    commissionBalance: FieldValue.increment(affiliateShare),
                    totalEarnings: FieldValue.increment(affiliateShare),
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                }
              }
            }
          }
        } catch {}
      } else if (status === 'rejected' && txData.type === 'withdrawal') {
        batch.update(clientRef, {
          balance: FieldValue.increment(txData.amount),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    });

    // Create client notification
    try {
      const clientId = txData.clientId;
      const amount = txData.amount;
      const isDeposit = txData.type === 'deposit';
      const isWithdrawal = txData.type === 'withdrawal';
      let notifTitle = '', notifMessage = '', notifType = '';
      if (status === 'approved' && isDeposit) {
        notifType = 'deposit_approved'; notifTitle = 'Dépôt approuvé';
        notifMessage = `Votre dépôt de $${Number(amount).toFixed(2)} a été approuvé et crédité sur votre compte.`;
      } else if (status === 'rejected' && isDeposit) {
        notifType = 'deposit_rejected'; notifTitle = 'Dépôt refusé';
        notifMessage = `Votre dépôt de $${Number(amount).toFixed(2)} a été refusé.${reason ? ` Raison: ${reason}` : ''}`;
      } else if (status === 'approved' && isWithdrawal) {
        notifType = 'withdrawal_approved'; notifTitle = 'Retrait approuvé';
        notifMessage = `Votre retrait de $${Number(amount).toFixed(2)} a été approuvé et est en cours de traitement.`;
      } else if (status === 'rejected' && isWithdrawal) {
        notifType = 'withdrawal_rejected'; notifTitle = 'Retrait refusé';
        notifMessage = `Votre retrait de $${Number(amount).toFixed(2)} a été refusé.${reason ? ` Raison: ${reason}` : ''} Le montant a été remis sur votre solde.`;
      }
      if (notifType && clientId) {
        await adminDb.collection('client_notifications').add({
          clientId, type: notifType, title: notifTitle, message: notifMessage,
          amount, txId, read: false, createdAt: FieldValue.serverTimestamp(),
        });
        sendFcmToClient(clientId, notifTitle, notifMessage, {
          type: notifType, txId: txId || '', amount: String(amount),
        });

        // SSE push for approved transactions (triggers real-time success modal in client UI)
        if (status === 'approved') {
          const settingsSnap = await adminDb.collection('settings').doc('global').get().catch(() => null);
          const exchRate = Number(settingsSnap?.data()?.exchangeRate || 135);
          pushClientEvent(clientId, 'tx_approved', {
            type: isDeposit ? 'deposit' : 'withdrawal',
            htg: Math.round(Number(amount) * exchRate),
            usd: Number(amount),
          });
        }

        // Resend email — notification de statut
        const clientEmailSnap = await adminDb.collection('clients').doc(clientId).get().catch(() => null);
        const clientEmail = clientEmailSnap?.exists ? clientEmailSnap.data()?.email : undefined;
        const clientName = txData.clientName || '';
        if (status === 'approved' && isDeposit) {
          fireEmail(() => emailDepositApproved({ clientName, clientEmail, amount }), { type: 'deposit_approved', to: clientEmail || '', clientId, amount });
        } else if (status === 'rejected' && isDeposit) {
          fireEmail(() => emailDepositRejected({ clientName, clientEmail, amount, reason }), { type: 'deposit_rejected', to: clientEmail || '', clientId, amount });
        } else if (status === 'approved' && isWithdrawal) {
          fireEmail(() => emailWithdrawalApproved({ clientName, clientEmail, amount }), { type: 'withdrawal_approved', to: clientEmail || '', clientId, amount });
        } else if (status === 'rejected' && isWithdrawal) {
          fireEmail(() => emailWithdrawalRejected({ clientName, clientEmail, amount, reason }), { type: 'withdrawal_rejected', to: clientEmail || '', clientId, amount });
        }
      }
    } catch (notifErr: any) {
      console.error('[transaction/status] notification error (non-fatal):', notifErr?.message);
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[transaction/status]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: delete all transaction history ────────────────────────────────────
router.delete('/api/admin/transactions/all', requireDb, async (req, res) => {
  try {
    let total = 0;
    let snap = await adminDb.collection('client_transactions').limit(400).get();
    while (!snap.empty) {
      const batch = adminDb.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += snap.size;
      if (snap.size < 400) break;
      snap = await adminDb.collection('client_transactions').limit(400).get();
    }
    res.json({ success: true, deleted: total });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: withdraw accumulated fees ────────────────────────────────────────
router.post('/api/admin/fees/withdraw', requireDb, async (req, res) => {
  try {
    const settingsRef = adminDb.collection('settings').doc('global');
    let withdrawn = 0;
    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(settingsRef);
      const current = snap.exists ? Number(snap.data()!.feesBalance || 0) : 0;
      if (current <= 0) throw new Error('Aucun frais à retirer.');
      withdrawn = current;
      txn.update(settingsRef, {
        feesBalance: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'fees_withdrawal',
        amount: current,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ success: true, withdrawn });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent fee records ─────────────────────────────────────────────────────────
router.get('/api/admin/agent-fee-records', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('agent_fee_records')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    res.json({ records: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: email audit logs ────────────────────────────────────────────────────
router.get('/api/admin/email-logs', requireDb, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const snap = await adminDb.collection('email_logs')
      .orderBy('sentAt', 'desc')
      .limit(limit)
      .get();
    res.json({ logs: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: directly credit/debit agent wallet ─────────────────────────────────
router.post('/api/admin/agent/:agentId/wallet/adjust', requireDb, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { type, wallet, amount, note } = req.body;
    // type: 'credit' | 'debit' | 'lock' | 'unlock'
    // wallet: 'balance' | 'commission'
    if (!type || !amount || !wallet) return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentRef = adminDb.collection('agents').doc(agentId);
    const field = wallet === 'commission' ? 'commissionBalance' : 'balance';
    const delta = type === 'credit' ? usd : -usd;
    const logRef = adminDb.collection('agent_wallet_adjustments').doc();
    await adminDb.runTransaction(async (txn) => {
      const agentSnap = await txn.get(agentRef);
      if (!agentSnap.exists) throw new Error('Agent introuvable.');
      const agentData = agentSnap.data()!;
      const currentVal = Number(agentData[field] || 0);
      if (type === 'debit' && currentVal < usd) {
        throw new Error(`Solde insuffisant (${currentVal.toFixed(2)} $).`);
      }
      txn.update(agentRef, {
        [field]: FieldValue.increment(delta),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(logRef, {
        agentId,
        agentCode: agentData.agentCode || '',
        agentName: agentData.name || '',
        type,
        wallet,
        amount: usd,
        delta,
        balanceBefore: currentVal,
        balanceAfter: parseFloat((currentVal + delta).toFixed(6)),
        note: note || '',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true });
  } catch (e: any) {
    console.error('[admin/agent/wallet/adjust]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: delete agent ───────────────────────────────────────────────────────
router.delete('/api/admin/agent/:agentId', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agentRef = adminDb.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return res.status(404).json({ error: 'Agent introuvable.' });
    const batch = adminDb.batch();
    batch.delete(agentRef);
    // Also delete reseller account if it exists
    const resellerRef = adminDb.collection('agent_reseller_accounts').doc(agentId);
    const resellerSnap = await resellerRef.get();
    if (resellerSnap.exists) batch.delete(resellerRef);
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[admin/agent/delete]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: toggle agent wallet lock ──────────────────────────────────────────
router.post('/api/admin/agent/:agentId/toggle-lock', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { agentId } = req.params;
    const agentRef = adminDb.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return res.status(404).json({ error: 'Agent introuvable.' });
    const currentLocked = agentSnap.data()!.walletLocked || false;
    await agentRef.update({
      walletLocked: !currentLocked,
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, walletLocked: !currentLocked });
  } catch (e: any) {
    console.error('[admin/agent/toggle-lock]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: agent wallet adjustment history ────────────────────────────────────
router.get('/api/admin/agent/:agentId/wallet/history', requireDb, async (req, res) => {
  try {
    const { agentId } = req.params;
    const snap = await adminDb.collection('agent_wallet_adjustments')
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    res.json({ records: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Client auth ───────────────────────────────────────────────────────────────
router.post('/api/client/register', requireDb, async (req, res) => {
  try {
    const { name, phone, email, password, sponsorCode } = req.body;
    if (!name || !phone || !email || !password)
      return res.status(400).json({ error: 'Paramètres manquants.' });

    const existing = await adminDb.collection('clients').where('email', '==', email).get();
    if (!existing.empty) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    let walletId = '', unique = false;
    while (!unique) {
      walletId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const wSnap = await adminDb.collection('clients').where('walletId', '==', walletId).get();
      if (wSnap.empty) unique = true;
    }

    let directSponsorId: string | undefined, indirectSponsorId: string | undefined;
    if (sponsorCode) {
      const affSnap = await adminDb.collection('affiliates').where('code', '==', sponsorCode).get();
      if (!affSnap.empty) {
        directSponsorId = affSnap.docs[0].id;
        const affData = affSnap.docs[0].data();
        if (affData.parentAffiliateId) indirectSponsorId = affData.parentAffiliateId;
      }
    }

    const clientData: any = {
      name, phone, email: String(email).trim().toLowerCase(), password: hashPassword(String(password)), balance: 0, walletId, status: 'active',
      ...(directSponsorId && { directSponsorId }),
      ...(indirectSponsorId && { indirectSponsorId }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection('clients').add(clientData);
    setClientSession(res, ref.id);
    // Increment referredClients on sponsor affiliates
    if (directSponsorId) {
      adminDb.collection('affiliates').doc(directSponsorId).update({
        referredClients: FieldValue.increment(1),
        monthlyReferredClients: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    if (indirectSponsorId) {
      adminDb.collection('affiliates').doc(indirectSponsorId).update({
        referredClients: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    const client = { id: ref.id, ...clientData, createdAt: null, updatedAt: null };
    delete client.password;
    res.json({ success: true, client });
  } catch (e: any) {
    console.error('[register]', e);
    res.status(500).json({ error: e.message || "Erreur lors de l'inscription." });
  }
});

router.post('/api/client/login', requireDb, async (req, res) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    // Query only by email. Combining email + password in Firestore requires a
    // composite index and caused a server error for otherwise valid logins.
    const snap = await adminDb.collection('clients')
      .where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    const clientDoc = snap.docs[0];
    const clientData = clientDoc.data() || {};
    if (!verifyPassword(password, clientData.password)) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }
    if (typeof clientData.password === 'string' && !clientData.password.startsWith('scrypt$')) {
      await clientDoc.ref.update({ password: hashPassword(password), updatedAt: FieldValue.serverTimestamp() });
    }

    const client = serializeDoc(clientDoc);
    delete client.password;
    setClientSession(res, clientDoc.id);
    res.json({ success: true, client });
  } catch (e: any) {
    console.error('[login]', e);
    res.status(500).json({ error: e.message || 'Erreur de connexion.' });
  }
});

router.post('/api/client/login-google', requireDb, async (req, res) => {
  try {
    const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
    if (!idToken) return res.status(400).json({ error: 'Jeton Google manquant.' });
    const decoded = await getAuth().verifyIdToken(idToken);
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Le compte Google doit contenir un email.' });
    const snap = await adminDb.collection('clients').where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Aucun compte client associé.', noAccount: true });
    const clientDoc = snap.docs[0];
    const data = clientDoc.data() || {};
    if (data.status === 'blocked') return res.status(403).json({ error: 'Votre compte est bloqué. Contactez le support.' });
    await clientDoc.ref.update({
      uid: decoded.uid,
      ...(decoded.picture ? { photoUrl: decoded.picture } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const client = serializeDoc(clientDoc);
    delete client.password;
    client.uid = decoded.uid;
    setClientSession(res, clientDoc.id);
    res.json({ success: true, client });
  } catch (e: any) {
    res.status(401).json({ error: e?.message || 'Connexion Google non vérifiée.' });
  }
});

router.post('/api/client/register-google', requireDb, async (req, res) => {
  try {
    const { phone, sponsorCode, idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Jeton Google manquant.' });
    const decoded = await getAuth().verifyIdToken(String(idToken));
    const googleUser = {
      email: String(decoded.email || '').trim().toLowerCase(),
      uid: decoded.uid,
      name: String(decoded.name || 'Client Solutionpam'),
      photoUrl: String(decoded.picture || ''),
    };
    if (!googleUser.email) return res.status(400).json({ error: 'Le compte Google doit contenir un email.' });

    const existing = await adminDb.collection('clients').where('email', '==', googleUser.email).get();
    if (!existing.empty) return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });

    let walletId = '', unique = false;
    while (!unique) {
      walletId = Math.floor(10000000 + Math.random() * 90000000).toString();
      const wSnap = await adminDb.collection('clients').where('walletId', '==', walletId).get();
      if (wSnap.empty) unique = true;
    }

    let directSponsorId: string | undefined, indirectSponsorId: string | undefined;
    if (sponsorCode) {
      const affSnap = await adminDb.collection('affiliates').where('code', '==', sponsorCode).get();
      if (!affSnap.empty) {
        directSponsorId = affSnap.docs[0].id;
        const affData = affSnap.docs[0].data();
        if (affData.parentAffiliateId) indirectSponsorId = affData.parentAffiliateId;
      }
    }

    const clientData: any = {
      name: googleUser.name, phone: phone || '',
      email: googleUser.email, uid: googleUser.uid,
      photoUrl: googleUser.photoUrl || '',
      balance: 0, walletId, status: 'active',
      ...(directSponsorId && { directSponsorId }),
      ...(indirectSponsorId && { indirectSponsorId }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection('clients').add(clientData);
    setClientSession(res, ref.id);
    // Increment referredClients on sponsor affiliates
    if (directSponsorId) {
      adminDb.collection('affiliates').doc(directSponsorId).update({
        referredClients: FieldValue.increment(1),
        monthlyReferredClients: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    if (indirectSponsorId) {
      adminDb.collection('affiliates').doc(indirectSponsorId).update({
        referredClients: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
    res.json({ success: true, client: { id: ref.id, ...clientData, createdAt: null, updatedAt: null } });
  } catch (e: any) {
    console.error('[register-google]', e);
    res.status(500).json({ error: e.message || "Erreur lors de l'inscription Google." });
  }
});

router.post('/api/client/logout', (_req, res) => {
  res.clearCookie('rena_client_session', { path: '/' });
  res.json({ success: true });
});

// ── Formations — Admin CRUD ───────────────────────────────────────────────────
router.use('/api/admin/formations', requireDb);

router.get('/api/admin/formations', async (_req, res) => {
  try {
    const snap = await adminDb.collection('formations').orderBy('createdAt', 'desc').get();
    res.json({ formations: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/admin/formations', async (req, res) => {
  try {
    const data = sanitizeFormation(req.body);
    if (!data.title) return res.status(400).json({ error: 'Le titre est requis.' });
    const ref = await adminDb.collection('formations').add({
      ...data,
      studentsCount: data.studentsCount ?? 0,
      rating: data.rating ?? 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) {
    console.error('[formations POST]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la création.' });
  }
});

router.put('/api/admin/formations/:id', async (req, res) => {
  try {
    const data = sanitizeFormation(req.body);
    await adminDb.collection('formations').doc(req.params.id).update({
      ...data, updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations PUT]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la mise à jour.' });
  }
});

router.delete('/api/admin/formations/:id', async (req, res) => {
  try {
    await adminDb.collection('formations').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations DELETE]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la suppression.' });
  }
});

router.get('/api/admin/formations/purchases', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('formation_purchases').orderBy('purchasedAt', 'desc').get();
    res.json({ purchases: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations purchases GET all]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.patch('/api/admin/formations/purchases/:id', requireDb, async (req, res) => {
  try {
    const { status, formationId } = req.body;
    if (!status) return res.status(400).json({ error: 'Statut requis.' });
    const batch = adminDb.batch();
    batch.update(adminDb.collection('formation_purchases').doc(req.params.id), {
      status, updatedAt: FieldValue.serverTimestamp(),
    });
    if (status === 'active' && formationId) {
      batch.update(adminDb.collection('formations').doc(formationId), {
        studentsCount: FieldValue.increment(1),
      });
    }
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations purchases PATCH]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.get('/api/admin/formations/payment-requests', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('formation_payment_requests').orderBy('createdAt', 'desc').get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formation payment-requests GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.patch('/api/admin/formations/payment-requests/:id', requireDb, async (req, res) => {
  try {
    const { action } = req.body;
    const reqSnap = await adminDb.collection('formation_payment_requests').doc(req.params.id).get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const data = reqSnap.data()!;
    const batch = adminDb.batch();
    if (action === 'approve') {
      batch.update(adminDb.collection('formation_payment_requests').doc(req.params.id), {
        status: 'approved', updatedAt: FieldValue.serverTimestamp(),
      });
      const purchaseRef = adminDb.collection('formation_purchases').doc();
      batch.set(purchaseRef, {
        userId: data.userId, userEmail: data.userEmail || '', userName: data.userName || '',
        formationId: data.formationId, formationTitle: data.formationTitle || '',
        amount: data.amount || 0, method: data.method || '',
        status: 'active',
        purchasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (data.formationId) {
        batch.update(adminDb.collection('formations').doc(data.formationId), {
          studentsCount: FieldValue.increment(1),
        });
      }
    } else if (action === 'reject') {
      batch.update(adminDb.collection('formation_payment_requests').doc(req.params.id), {
        status: 'rejected', updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    // Credit teacher for MonCash-approved formation purchase (minus platform commission)
    if (action === 'approve' && data.formationId && (data.amount || 0) > 0) {
      try {
        const settingsSnap = await adminDb.collection('settings').doc('main').get();
        const exchangeRate = settingsSnap.exists ? (settingsSnap.data()!.exchangeRate ?? 146) : 146;
        const formationFee = settingsSnap.exists ? (settingsSnap.data()!.formationPurchaseFee ?? 0) : 0;
        const formSnap = await adminDb.collection('formations').doc(data.formationId).get();
        const teacherId = formSnap.exists ? formSnap.data()!.teacherId : null;
        const teacherName = formSnap.exists ? formSnap.data()!.teacherName : null;
        if (teacherId) {
          const teacherRef = adminDb.collection('teachers').doc(teacherId);
          const teacherSnap = await teacherRef.get();
          if (teacherSnap.exists) {
            const amountUSD = (data.amount || 0) / exchangeRate;
            const platformCut = Math.round(amountUSD * formationFee) / 100;
            const teacherAmount = amountUSD - platformCut;
            if (teacherAmount > 0) {
              const teacherBatch = adminDb.batch();
              teacherBatch.update(teacherRef, {
                balance: (teacherSnap.data()!.balance || 0) + teacherAmount,
                updatedAt: FieldValue.serverTimestamp(),
              });
              const txRef = adminDb.collection('teacher_transactions').doc();
              teacherBatch.set(txRef, {
                teacherId,
                teacherName: teacherName || '',
                type: 'sale_credit',
                amount: teacherAmount,
                platformFee: platformCut,
                formationId: data.formationId,
                formationTitle: data.formationTitle || '',
                clientName: data.userName || '',
                status: 'completed',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });
              await teacherBatch.commit();

              // Real-time: notify teacher of sale via SSE + FCM (fire-and-forget)
              const teacherNotifData = {
                teacherId,
                title: '💰 Nouvelle vente de formation',
                message: `"${data.formationTitle || 'Formation'}" achetée par ${data.userName || 'un client'}. Crédit : $${teacherAmount.toFixed(2)}`,
                type: 'sale_credit',
                amount: teacherAmount,
                formationId: data.formationId,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              };
              const teacherNotifRef = adminDb.collection('teacher_notifications').doc();
              await teacherNotifRef.set(teacherNotifData);
              const teacherSsePayload = { id: teacherNotifRef.id, ...teacherNotifData, createdAt: { _seconds: Date.now() / 1000 } };
              pushRoleEvent('teacher', teacherId, 'new_notification', teacherSsePayload);
              sendFcmToRole('teacher', teacherId, teacherNotifData.title, teacherNotifData.message).catch(() => {});
            }
          }
        }
      } catch (teacherErr: any) {
        console.error('[formation payment-request approve] teacher credit error:', teacherErr.message);
      }
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[formation payment-requests PATCH]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

// ── Online Sub-Services ───────────────────────────────────────────────────────
router.get('/api/online-sub-services', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('online_sub_services').orderBy('order', 'asc').get();
    res.json({ services: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/admin/online-sub-services', requireDb, async (req, res) => {
  try {
    const { id, createdAt: _c, ...data } = req.body;
    if (id) {
      await adminDb.collection('online_sub_services').doc(id).set({ ...data, updatedAt: new Date() }, { merge: true });
      return res.json({ success: true, id });
    } else {
      const ref = await adminDb.collection('online_sub_services').add({ ...data, createdAt: new Date() });
      return res.json({ success: true, id: ref.id });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/admin/online-sub-services/:id', requireDb, async (req, res) => {
  try {
    await adminDb.collection('online_sub_services').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Formations — Public & User ─────────────────────────────────────────────────
router.use('/api/formations', requireDb);

// Strips paid content (video/PDF URLs, resources, quiz answer keys) from a
// formation document before it reaches a browser that hasn't purchased it.
// Quiz correctIndex is always stripped — scoring happens server-side via
// /api/formations/quiz/submit, the browser never needs the answer key.
function redactFormationForViewer(f: any, owns: boolean): any {
  const stripQuiz = (chapter: any) => {
    if (!chapter?.quiz?.questions) return chapter;
    return {
      ...chapter,
      quiz: {
        ...chapter.quiz,
        questions: chapter.quiz.questions.map((q: any) => ({ id: q.id, question: q.question, options: q.options })),
      },
    };
  };
  if (owns) {
    return {
      ...f,
      chapters: Array.isArray(f.chapters) ? f.chapters.map(stripQuiz) : f.chapters,
    };
  }
  return {
    ...f,
    modules: Array.isArray(f.modules)
      ? f.modules.map((m: any) => ({ id: m.id, title: m.title, duration: m.duration, order: m.order, description: m.description, chapterId: m.chapterId }))
      : f.modules,
    chapters: Array.isArray(f.chapters)
      ? f.chapters.map((c: any) => ({ id: c.id, title: c.title, order: c.order, description: c.description, hasQuiz: !!c.quiz?.questions?.length }))
      : f.chapters,
    pdfUrl: undefined,
    resources: undefined,
  };
}

router.get('/api/formations', async (req, res) => {
  try {
    const snap = await adminDb.collection('formations').orderBy('createdAt', 'desc').get();
    const formations = snap.docs.map(serializeDoc).filter((f: any) => f.published || f.comingSoon);

    // Optional session: logged-in clients see full content only for formations
    // they actually own (active purchase). Anonymous/other visitors see the
    // catalog with protected content stripped.
    const session = readClientSession(req);
    let ownedIds = new Set<string>();
    if (session) {
      const purchasesSnap = await adminDb.collection('formation_purchases')
        .where('userId', '==', session.clientId).where('status', '==', 'active').get();
      ownedIds = new Set(purchasesSnap.docs.map(d => d.data().formationId));
    }
    const redacted = formations.map((f: any) => redactFormationForViewer(f, !!f.id && ownedIds.has(f.id)));
    res.json({ formations: redacted });
  } catch (e: any) {
    console.error('[formations public GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.get('/api/formations/purchases/user/:userId', requireClientSession, async (req, res) => {
  try {
    if (res.locals.clientSession.clientId !== req.params.userId) return res.status(403).json({ error: 'Accès refusé.' });
    // Lazy reconciliation: finalize any Paym Plop Plop payment that confirmed
    // while this client's session/tab was gone. This guarantees a purchase is
    // never lost just because the browser wasn't around to see the confirmation —
    // the very next time this client's account is touched, it gets settled here.
    try {
      const pendingPpSnap = await adminDb.collection('formation_plopplop_payments')
        .where('clientId', '==', req.params.userId).where('status', '==', 'pending').get();
      if (!pendingPpSnap.empty) {
        await Promise.all(pendingPpSnap.docs.map(d => verifyAndFinalizePlopPlopPayment(d.id).catch(() => {})));
      }
    } catch (reconcileErr: any) {
      console.error('[formations purchases GET user] plopplop reconcile error:', reconcileErr.message);
    }
    const snap = await adminDb.collection('formation_purchases')
      .where('userId', '==', req.params.userId).get();
    res.json({ purchases: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations purchases GET user]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/formations/purchases', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { userEmail, userName, formationId, formationTitle, amount, method } = req.body;
    if (!formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
    const existing = await adminDb.collection('formation_purchases')
      .where('userId', '==', userId).where('formationId', '==', formationId).where('status', '==', 'pending').get();
    if (!existing.empty) return res.json({ success: true, id: existing.docs[0].id, alreadyExists: true });
    const ref = await adminDb.collection('formation_purchases').add({
      userId, userEmail: userEmail || '', userName: userName || '',
      formationId, formationTitle: formationTitle || '', amount: amount || 0, method: method || '',
      status: 'pending',
      purchasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) {
    console.error('[formations purchases POST]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

// Credits the formation's teacher (minus the platform's commission) for one
// sale, and notifies them in real time. Shared by every automatic purchase
// path (wallet, Paym Plop Plop) so the fee split never drifts between them.
async function creditTeacherForFormationSale(params: {
  formationId: string;
  formationTitle?: string;
  clientName?: string;
  amountUSD: number;
}): Promise<{ teacherAmount: number; platformCut: number } | null> {
  if (!params.formationId || params.amountUSD <= 0) return null;
  try {
    const [formSnap, feeSettingsSnap] = await Promise.all([
      adminDb.collection('formations').doc(params.formationId).get(),
      adminDb.collection('settings').doc('main').get(),
    ]);
    const teacherId = formSnap.exists ? formSnap.data()!.teacherId : null;
    const teacherName = formSnap.exists ? formSnap.data()!.teacherName : null;
    const formationFee = feeSettingsSnap.exists ? (feeSettingsSnap.data()!.formationPurchaseFee ?? 0) : 0;
    const platformCut = Math.round(params.amountUSD * formationFee) / 100;
    const teacherAmount = params.amountUSD - platformCut;
    if (!teacherId || teacherAmount <= 0) return null;
    const teacherRef = adminDb.collection('teachers').doc(teacherId);
    const teacherSnap = await teacherRef.get();
    if (!teacherSnap.exists) return null;

    const batch = adminDb.batch();
    batch.update(teacherRef, {
      balance: (teacherSnap.data()!.balance || 0) + teacherAmount,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const txRef = adminDb.collection('teacher_transactions').doc();
    batch.set(txRef, {
      teacherId, teacherName: teacherName || '',
      type: 'sale_credit', amount: teacherAmount, platformFee: platformCut,
      formationId: params.formationId, formationTitle: params.formationTitle || '',
      clientName: params.clientName || '', status: 'completed',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    const teacherNotifData = {
      teacherId,
      title: '💰 Nouvelle vente de formation',
      message: `"${params.formationTitle || 'Formation'}" achetée par ${params.clientName || 'un client'}. Crédit : $${teacherAmount.toFixed(2)}`,
      type: 'sale_credit', amount: teacherAmount, formationId: params.formationId,
      read: false, createdAt: FieldValue.serverTimestamp(),
    };
    const teacherNotifRef = adminDb.collection('teacher_notifications').doc();
    await teacherNotifRef.set(teacherNotifData);
    pushRoleEvent('teacher', teacherId, 'new_notification', { id: teacherNotifRef.id, ...teacherNotifData, createdAt: { _seconds: Date.now() / 1000 } });
    sendFcmToRole('teacher', teacherId, teacherNotifData.title, teacherNotifData.message).catch(() => {});

    return { teacherAmount, platformCut };
  } catch (e: any) {
    console.error('[creditTeacherForFormationSale]', e.message);
    return null;
  }
}

router.post('/api/formations/purchases/wallet', requireClientSession, async (req, res) => {
  try {
    const clientId = res.locals.clientSession.clientId;
    const { clientName, formationId, formationTitle } = req.body;
    if (!formationId) return res.status(400).json({ error: 'Paramètres manquants.' });

    const existingSnap = await adminDb.collection('formation_purchases')
      .where('userId', '==', clientId).where('formationId', '==', formationId).where('status', '==', 'active').get();
    if (!existingSnap.empty) return res.json({ success: true, alreadyOwned: true });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const formationRef = adminDb.collection('formations').doc(formationId);
    const settingsRef = adminDb.collection('settings').doc('main');
    const ownershipRef = adminDb.collection('formation_ownership').doc(
      createHash('sha256').update(`${clientId}|${formationId}`).digest('hex')
    );
    const purchaseRef = adminDb.collection('formation_purchases').doc();
    let price = 0;
    let clientData: any = {};
    let alreadyOwned = false;
    await adminDb.runTransaction(async (batch) => {
      const [clientSnap, formSnap, settingsSnap, ownershipSnap] = await Promise.all([
        batch.get(clientRef), batch.get(formationRef), batch.get(settingsRef), batch.get(ownershipRef),
      ]);
      if (!clientSnap.exists) throw new Error('Client introuvable.');
      if (!formSnap.exists) throw new Error('Formation introuvable.');
      if (ownershipSnap.exists) {
        alreadyOwned = true;
        return;
      }
      clientData = clientSnap.data()!;
      const exchangeRate = settingsSnap.exists ? (settingsSnap.data()!.exchangeRate ?? 146) : 146;
      price = (Number(formSnap.data()!.price) || 0) / exchangeRate;
      if (price > 0 && Number(clientData.balance || 0) < price) throw new Error('Solde insuffisant.');
      if (price > 0) {
        batch.update(clientRef, {
          balance: FieldValue.increment(-price),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      batch.set(purchaseRef, {
        userId: clientId, userEmail: clientData.email || '',
        userName: clientName || clientData.name || '',
        formationId, formationTitle: formationTitle || '',
        amount: price, method: price === 0 ? 'Gratuit' : 'Wallet', status: 'active',
        purchasedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(ownershipRef, {
        userId: clientId, formationId, purchaseId: purchaseRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      batch.update(formationRef, { studentsCount: FieldValue.increment(1) });
      if (price > 0) {
        batch.set(adminDb.collection('admin_notifications').doc(), {
          type: 'formation_purchase', clientId,
          clientName: clientName || clientData.name || '',
          formationId, formationTitle: formationTitle || '',
          amount: price, method: 'Wallet', read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });
    if (alreadyOwned) {
      return res.json({ success: true, alreadyOwned: true });
    }

    // Credit teacher if formation belongs to one (minus platform commission)
    if (price > 0 && formationId) {
      creditTeacherForFormationSale({
        formationId, formationTitle, clientName: clientName || clientData.name, amountUSD: price,
      }).catch((teacherErr: any) => console.error('[formations/purchases/wallet] teacher credit error:', teacherErr?.message));
    }

    // Auto-commission pour le parrain du client (formation)
    if (price > 0 && clientData.directSponsorId) {
      // Récupère le taux de commission défini sur la formation (si configuré)
      const formCommissionRate = formationId
        ? await adminDb.collection('formations').doc(formationId).get()
            .then(s => (s.exists ? (s.data()!.commissionRate as number | undefined) : undefined))
            .catch(() => undefined)
        : undefined;
      triggerAffiliateCommissions(clientData.directSponsorId, 'subscription', formationTitle || 'Formation', price, formCommissionRate).catch(() => {});
    }

    // Email admin + client pour achat formation
    if (price > 0) {
      const recipientEmail = clientData.email || '';
      const recipientName = clientName || clientData.name || '';
      fireEmail(
        () => emailFormationPurchase({ clientName: recipientName, clientEmail: recipientEmail, formationTitle: formationTitle || '', amount: price }),
        { type: 'formation_purchase', to: [ADMIN_EMAIL, ...(recipientEmail ? [recipientEmail] : [])], clientId, amount: price }
      );
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations/purchases/wallet]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ─── Paym Plop Plop (automatic MonCash / MonCash USSD / NatCash / Carte / Kashpaw) ──
//
// Reliability design: the pending payment doc is keyed by our own referenceId
// and tied to the client's account (not their browser session). Whether the
// client's tab stays open (active polling below) or is closed/lost mid-payment
// (lazy reconciliation on GET /api/formations/purchases/user/:userId above),
// the purchase is finalized exactly once, the moment Plop Plop confirms it —
// never dependent on the client still being present.

async function verifyAndFinalizePlopPlopPayment(paymentDocId: string): Promise<{ status: 'pending' | 'completed' | 'failed' }> {
  const payRef = adminDb.collection('formation_plopplop_payments').doc(paymentDocId);
  const paySnap = await payRef.get();
  if (!paySnap.exists) return { status: 'failed' };
  const pay = paySnap.data()!;
  if (pay.status === 'completed' || pay.status === 'failed') return { status: pay.status };

  let verifyData: any;
  try {
    verifyData = await verifyPlopPlopPayment(pay.referenceId);
  } catch (e: any) {
    console.error('[plopplop verify] network error:', e.message);
    return { status: 'pending' };
  }
  if (verifyData?.trans_status !== 'ok') return { status: 'pending' };

  // Confirmed by Plop Plop — finalize idempotently (a concurrent poll + the
  // lazy reconciliation hook could both land here at nearly the same time).
  const result = await adminDb.runTransaction(async (tx) => {
    const freshSnap = await tx.get(payRef);
    const fresh = freshSnap.data()!;
    if (fresh.status === 'completed') return 'already';
    tx.update(payRef, { status: 'completed', updatedAt: FieldValue.serverTimestamp(), completedAt: FieldValue.serverTimestamp() });
    const purchaseRef = adminDb.collection('formation_purchases').doc();
    tx.set(purchaseRef, {
      userId: fresh.clientId, userEmail: fresh.clientEmail || '', userName: fresh.clientName || '',
      formationId: fresh.formationId, formationTitle: fresh.formationTitle || '',
      amount: fresh.amountHTG || 0, method: `PlopPlop (${fresh.method})`,
      status: 'active', purchasedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    if (fresh.formationId) {
      tx.update(adminDb.collection('formations').doc(fresh.formationId), { studentsCount: FieldValue.increment(1) });
    }
    return 'finalized';
  });

  if (result === 'finalized') {
    try {
      const [settingsSnap, clientSnap] = await Promise.all([
        adminDb.collection('settings').doc('main').get(),
        adminDb.collection('clients').doc(pay.clientId).get(),
      ]);
      const exchangeRate = settingsSnap.exists ? (settingsSnap.data()!.exchangeRate ?? 146) : 146;
      const amountUSD = (pay.amountHTG || 0) / exchangeRate;
      const clientData = clientSnap.exists ? clientSnap.data()! : {};

      await creditTeacherForFormationSale({
        formationId: pay.formationId, formationTitle: pay.formationTitle, clientName: pay.clientName, amountUSD,
      });

      await adminDb.collection('admin_notifications').add({
        type: 'formation_purchase', clientId: pay.clientId, clientName: pay.clientName || '',
        formationId: pay.formationId, formationTitle: pay.formationTitle || '',
        amount: amountUSD, method: `PlopPlop (${pay.method})`, read: false, createdAt: FieldValue.serverTimestamp(),
      });

      if (clientData.directSponsorId) {
        const formCommissionRate = pay.formationId
          ? await adminDb.collection('formations').doc(pay.formationId).get()
              .then(s => (s.exists ? (s.data()!.commissionRate as number | undefined) : undefined))
              .catch(() => undefined)
          : undefined;
        triggerAffiliateCommissions(clientData.directSponsorId, 'subscription', pay.formationTitle || 'Formation', amountUSD, formCommissionRate).catch(() => {});
      }

      const recipientEmail = pay.clientEmail || clientData.email || '';
      fireEmail(
        () => emailFormationPurchase({ clientName: pay.clientName || '', clientEmail: recipientEmail, formationTitle: pay.formationTitle || '', amount: amountUSD }),
        { type: 'formation_purchase', to: [ADMIN_EMAIL, ...(recipientEmail ? [recipientEmail] : [])], clientId: pay.clientId, amount: amountUSD }
      );
    } catch (e: any) {
      console.error('[plopplop finalize] post-processing error:', e.message);
    }
  }

  return { status: 'completed' };
}

router.post('/api/formations/purchases/plopplop/create', requireClientSession, async (req, res) => {
  try {
    const clientId = res.locals.clientSession.clientId;
    const { formationId, method, phoneNumber } = req.body;
    if (!formationId || !method) return res.status(400).json({ error: 'Paramètres manquants.' });
    if (!PLOPPLOP_METHODS.includes(method)) return res.status(400).json({ error: 'Méthode de paiement invalide.' });
    if (method === 'moncash_ussd' && !String(phoneNumber || '').trim()) {
      return res.status(400).json({ error: 'Numéro de téléphone requis pour MonCash USSD.' });
    }

    const existingSnap = await adminDb.collection('formation_purchases')
      .where('userId', '==', clientId).where('formationId', '==', formationId).where('status', '==', 'active').get();
    if (!existingSnap.empty) return res.json({ success: true, alreadyOwned: true });

    const [clientSnap, formSnap] = await Promise.all([
      adminDb.collection('clients').doc(clientId).get(),
      adminDb.collection('formations').doc(formationId).get(),
    ]);
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    if (!formSnap.exists) return res.status(404).json({ error: 'Formation introuvable.' });
    const clientData = clientSnap.data()!;
    const formation = formSnap.data()!;

    // Price is always the formation's real price, looked up server-side —
    // never trust a client-supplied amount for a real money charge.
    const priceHTG = Number(formation.price) || 0;
    if (priceHTG < 20) return res.status(400).json({ error: 'Le montant minimum accepté par Paym Plop Plop est de 20 HTG.' });

    const referenceId = `FORM-${String(formationId).slice(0, 10)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let ppResponse;
    try {
      ppResponse = await createPlopPlopPayment({
        referenceId, amountHTG: priceHTG, method: method as PlopPlopMethod,
        phoneNumber: phoneNumber ? String(phoneNumber).trim() : undefined,
      });
    } catch (ppErr: any) {
      console.error('[plopplop create]', ppErr.message);
      return res.status(502).json({ error: ppErr.message || 'Paym Plop Plop est momentanément indisponible.' });
    }

    const payRef = adminDb.collection('formation_plopplop_payments').doc();
    await payRef.set({
      clientId, clientName: clientData.name || '', clientEmail: clientData.email || '',
      formationId, formationTitle: formation.title || '',
      amountHTG: priceHTG, method, phoneNumber: phoneNumber ? String(phoneNumber).trim() : null,
      referenceId, ppTransactionId: ppResponse.transaction_id || null,
      redirectUrl: ppResponse.url || null,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });

    res.json({ success: true, referenceId, url: ppResponse.url || null, transactionId: ppResponse.transaction_id || null });
  } catch (e: any) {
    console.error('[formations/purchases/plopplop/create]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.get('/api/formations/purchases/plopplop/status/:referenceId', requireClientSession, async (req, res) => {
  try {
    const snap = await adminDb.collection('formation_plopplop_payments')
      .where('referenceId', '==', req.params.referenceId).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Paiement introuvable.' });
    const doc = snap.docs[0];
    if (doc.data().clientId !== res.locals.clientSession.clientId) return res.status(403).json({ error: 'Accès refusé.' });
    const result = await verifyAndFinalizePlopPlopPayment(doc.id);
    res.json(result);
  } catch (e: any) {
    console.error('[formations/purchases/plopplop/status]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.post('/api/formations/free-access', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { userEmail, userName, formationId, formationTitle } = req.body;
    if (!formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
    const existing = await adminDb.collection('formation_purchases')
      .where('userId', '==', userId).where('formationId', '==', formationId).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ status: 'active', updatedAt: FieldValue.serverTimestamp() });
    } else {
      const batch = adminDb.batch();
      const ref = adminDb.collection('formation_purchases').doc();
      batch.set(ref, {
        userId, userEmail: userEmail || '', userName: userName || '',
        formationId, formationTitle: formationTitle || '', amount: 0, method: 'Gratuit',
        status: 'active',
        purchasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(adminDb.collection('formations').doc(formationId), {
        studentsCount: FieldValue.increment(1),
      });
      await batch.commit();
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations free-access POST]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/formations/user', async (req, res) => {
  try {
    const { uid, email, displayName, photoURL } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID requis.' });
    await adminDb.collection('formation_users').doc(uid).set(
      { uid, email: email || '', displayName: displayName || '', photoURL: photoURL || '', updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations user POST]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/formations/payment-request', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { userEmail, userName, formationId, formationTitle, amount, method, transactionCode } = req.body;
    if (!formationId || !method || !transactionCode)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const existing = await adminDb.collection('formation_purchases')
      .where('userId', '==', userId).where('formationId', '==', formationId).where('status', '==', 'active').get();
    if (!existing.empty) return res.json({ success: true, alreadyOwned: true });
    const batch = adminDb.batch();
    const reqRef = adminDb.collection('formation_payment_requests').doc();
    batch.set(reqRef, {
      userId, userEmail: userEmail || '', userName: userName || '',
      formationId, formationTitle: formationTitle || '',
      amount: amount || 0, method, transactionCode,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const notifRef = adminDb.collection('admin_notifications').doc();
    batch.set(notifRef, {
      type: 'formation_payment_request',
      clientId: userId, clientName: userName || '',
      formationId, formationTitle: formationTitle || '',
      amount: amount || 0, method, transactionCode,
      status: 'pending', read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    res.json({ success: true, id: reqRef.id });
  } catch (e: any) {
    console.error('[formation payment-request POST]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

// ── Formation Progress ─────────────────────────────────────────────────────────
router.get('/api/formations/progress/:userId', requireClientSession, async (req, res) => {
  try {
    if (res.locals.clientSession.clientId !== req.params.userId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('formation_progress')
      .where('userId', '==', req.params.userId).get();
    res.json({ progress: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations progress GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.get('/api/formations/progress/:userId/:formationId', requireClientSession, async (req, res) => {
  try {
    const { userId, formationId } = req.params;
    if (res.locals.clientSession.clientId !== userId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('formation_progress').doc(`${userId}_${formationId}`).get();
    if (!snap.exists) return res.json({ progress: null });
    res.json({ progress: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/formations/progress', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { userEmail, formationId, moduleId, totalModules } = req.body;
    if (!formationId || !moduleId || !totalModules)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const snap = await adminDb.collection('formation_progress')
      .where('userId', '==', userId).where('formationId', '==', formationId).get();
    const now = FieldValue.serverTimestamp();
    if (snap.empty) {
      const completedModules = [moduleId];
      const percentage = Math.round((1 / Number(totalModules)) * 100);
      await adminDb.collection('formation_progress').add({
        userId, userEmail: userEmail || '', formationId,
        completedModules, percentage, startedAt: now, lastAccessedAt: now,
        ...(percentage === 100 ? { completedAt: now } : {}),
      });
    } else {
      const docRef = snap.docs[0].ref;
      const data = snap.docs[0].data();
      const completedModules = Array.from(new Set([...(data.completedModules || []), moduleId]));
      const percentage = Math.round((completedModules.length / Number(totalModules)) * 100);
      await docRef.update({
        completedModules, percentage, lastAccessedAt: now,
        ...(percentage === 100 ? { completedAt: now } : {}),
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error('[formations progress POST]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/formations/progress/complete', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { formationId, moduleId } = req.body;
    if (!formationId || !moduleId)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const docId = `${userId}_${formationId}`;
    const ref = adminDb.collection('formation_progress').doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      const existing = snap.data()!.completedModuleIds || [];
      if (!existing.includes(moduleId)) {
        await ref.update({
          completedModuleIds: FieldValue.arrayUnion(moduleId),
          currentModuleId: moduleId,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      await ref.set({
        userId, formationId,
        completedModuleIds: [moduleId],
        currentModuleId: moduleId,
        lastPositionSeconds: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/formations/progress/position', requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { formationId, moduleId, positionSeconds } = req.body;
    if (!formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
    const docId = `${userId}_${formationId}`;
    const ref = adminDb.collection('formation_progress').doc(docId);
    const snap = await ref.get();
    if (snap.exists) {
      await ref.update({
        currentModuleId: moduleId,
        lastPositionSeconds: positionSeconds || 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await ref.set({
        userId, formationId,
        completedModuleIds: [],
        currentModuleId: moduleId,
        lastPositionSeconds: positionSeconds || 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin Login (server-side — élimine la dépendance à l'auth anonyme) ───────
router.post('/api/admin/login', requireDb, async (req, res) => {
  try {
    const { fullName, password, loginCode } = req.body;
    if (!fullName || !password)
      return res.status(400).json({ error: 'Identifiants requis.' });

    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

    const snap = await adminDb.collection('admin_accounts').where('fullName', '==', fullName).limit(1).get();
    if (snap.empty) {
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, ip: clientIp, reason: 'user_not_found', timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const adminDoc = snap.docs[0];
    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };

    if (adminData.lockUntil) {
      const lockDate = adminData.lockUntil?.toDate ? adminData.lockUntil.toDate() : new Date(adminData.lockUntil);
      if (lockDate > new Date()) {
        await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, ip: clientIp, reason: 'account_locked', timestamp: FieldValue.serverTimestamp() });
        return res.status(403).json({ error: 'Compte bloqué temporairement. Réessayez plus tard.' });
      }
    }

    const storedPassword = adminData.passwordHash || adminData.password;
    if (!verifyPassword(String(password), storedPassword)) {
      const newAttempts = (adminData.failedAttempts || 0) + 1;
      const upd: any = { failedAttempts: newAttempts };
      if (newAttempts >= 5) upd.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await adminDoc.ref.update(upd);
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, ip: clientIp, reason: 'wrong_password', failedAttempts: newAttempts, timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (adminData.isSuperAdmin && adminData.loginCode && adminData.loginCode !== loginCode) {
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, ip: clientIp, reason: 'wrong_login_code', timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Code de connexion incorrect.' });
    }

    // ── 2FA: send OTP via email ──────────────────────────────────────────────
    const email: string | undefined = adminData.email;
    if (!email) {
      return res.status(422).json({ error: 'Aucun email configuré sur ce compte. Contactez le super-administrateur pour associer un email à votre compte.' });
    }

    const securityUpdate: Record<string, unknown> = {
      failedAttempts: 0,
      lockUntil: null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Upgrade legacy plaintext credentials only after a successful login.
    if (!adminData.passwordHash && typeof adminData.password === 'string') {
      securityUpdate.passwordHash = hashPassword(String(password));
      securityUpdate.password = FieldValue.delete();
    }
    await adminDoc.ref.update(securityUpdate);

    const { sessionId, otpPlain } = await create2FASession({ role: 'admin', accountId: adminDoc.id, email, name: adminData.fullName });
    await send2FAOtp({ email, name: adminData.fullName, role: 'admin', otpCode: otpPlain, expiresMinutes: 5 });
    await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, ip: clientIp, reason: '2fa_pending', timestamp: FieldValue.serverTimestamp() });

    res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(email) });
  } catch (e: any) {
    console.error('[admin/login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// ── Admin: Verify 2FA OTP (phase 2 for both credential + Google logins) ──────
router.post('/api/admin/verify-2fa', requireDb, async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) return res.status(400).json({ error: 'Paramètres manquants.' });

    const result = await verify2FASession(sessionId, code, 'admin');
    if (!result.ok) return res.status(401).json({ error: result.error });

    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

    // Fetch full admin doc (fresh, not cached in session)
    const adminSnap = await adminDb.collection('admin_accounts').doc(result.accountId!).get();
    if (!adminSnap.exists) return res.status(404).json({ error: 'Compte introuvable.' });

    await adminDb.collection('admin_login_logs').add({ adminName: result.name, success: true, ip: clientIp, reason: '2fa_verified', timestamp: FieldValue.serverTimestamp() });

    const admin = serializeDoc(adminSnap);
    delete admin.password;
    delete admin.passwordHash;
    // A short-lived custom token bridges the verified server session to the
    // existing admin-only Firestore dashboard listeners without a writable
    // browser-side privilege mapping.
    const firebaseToken = await issueAdminFirebaseToken(adminSnap.ref, adminSnap.data());
    setAdminSession(res, adminSnap.id);
    res.json({ success: true, admin, firebaseToken, hasPin: !!adminSnap.data()?.pinHash });
  } catch (e: any) {
    console.error('[admin/verify-2fa]', e);
    res.status(500).json({ error: 'Erreur de vérification.' });
  }
});

router.post('/api/admin/logout', (_req, res) => {
  res.clearCookie('rena_admin_session', { path: '/' });
  res.json({ success: true });
});

// ── Admin: Verify Google login → triggers 2FA (phase 1) ──────────────────────
router.post('/api/admin/verify-google', requireDb, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Jeton Google manquant.' });
    const token = await getAuth().verifyIdToken(idToken);
    const email = token.email?.toLowerCase();
    const uid = token.uid;
    if (!email || !uid || !token.email_verified) return res.status(401).json({ error: 'Compte Google non vérifié.' });
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

    let adminSnap = await adminDb.collection('admin_accounts').where('email', '==', email.toLowerCase()).limit(1).get();
    if (adminSnap.empty) {
      adminSnap = await adminDb.collection('admin_accounts').where('uid', '==', uid).limit(1).get();
    }
    if (adminSnap.empty) {
      await adminDb.collection('admin_login_logs').add({ adminName: email, success: false, ip: clientIp, reason: 'not_admin', timestamp: FieldValue.serverTimestamp() });
      return res.status(403).json({ error: `Accès refusé. L'adresse "${email}" n'est associée à aucun compte administrateur Solutionpam.` });
    }

    const adminDoc = adminSnap.docs[0];
    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };

    if (adminData.lockUntil) {
      const lockDate = adminData.lockUntil?.toDate ? adminData.lockUntil.toDate() : new Date(adminData.lockUntil);
      if (lockDate > new Date()) {
        return res.status(403).json({ error: 'Compte bloqué temporairement. Réessayez plus tard.' });
      }
    }

    // Save uid/email to account if first Google login
    const updates: any = { failedAttempts: 0, updatedAt: FieldValue.serverTimestamp() };
    if (!adminData.uid) updates.uid = uid;
    if (!adminData.email) updates.email = email.toLowerCase();
    await adminDoc.ref.update(updates);

    // ── 2FA: send OTP to the Google email ───────────────────────────────────
    const otpEmail = adminData.email || email.toLowerCase();
    const { sessionId, otpPlain } = await create2FASession({
      role: 'admin',
      accountId: adminDoc.id,
      email: otpEmail,
      name: adminData.fullName,
      extra: { uid }, // needed for admin_uids write after verify
    });
    await send2FAOtp({ email: otpEmail, name: adminData.fullName, role: 'admin', otpCode: otpPlain, expiresMinutes: 5 });
    await adminDb.collection('admin_login_logs').add({ adminName: adminData.fullName, success: false, ip: clientIp, reason: '2fa_pending', timestamp: FieldValue.serverTimestamp() });

    res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(otpEmail) });
  } catch (e: any) {
    console.error('[admin/verify-google]', e);
    res.status(500).json({ error: 'Erreur vérification Google.' });
  }
});

// ── Admin: Link Google account to existing admin (verify creds first) ────────
router.post('/api/admin/link-google', requireDb, async (req, res) => {
  try {
    const { loginCode, idToken } = req.body;
    if (!loginCode || !idToken)
      return res.status(400).json({ error: 'Données manquantes.' });
    const token = await getAuth().verifyIdToken(idToken);
    const email = token.email?.toLowerCase();
    const uid = token.uid;
    if (!email || !uid || !token.email_verified) return res.status(401).json({ error: 'Compte Google non vérifié.' });

    // Find admin account by loginCode (unique secret per account)
    const snap = await adminDb.collection('admin_accounts').where('loginCode', '==', loginCode).limit(1).get();
    if (snap.empty)
      return res.status(401).json({ error: 'Code secret incorrect. Vérifiez votre code de connexion.' });

    const adminDoc = snap.docs[0];
    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };

    if (adminData.lockUntil) {
      const lockDate = adminData.lockUntil?.toDate ? adminData.lockUntil.toDate() : new Date(adminData.lockUntil);
      if (lockDate > new Date())
        return res.status(403).json({ error: 'Compte bloqué temporairement. Réessayez plus tard.' });
    }

    await adminDoc.ref.update({
      email: email.toLowerCase(),
      uid,
      failedAttempts: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection('admin_login_logs').add({ adminName: adminData.fullName, success: false, reason: '2fa_pending', timestamp: FieldValue.serverTimestamp() });

    // ── 2FA ──────────────────────────────────────────────────────────────────
    const { sessionId, otpPlain } = await create2FASession({
      role: 'admin',
      accountId: adminDoc.id,
      email: email.toLowerCase(),
      name: adminData.fullName,
      extra: { uid },
    });
    await send2FAOtp({ email: email.toLowerCase(), name: adminData.fullName, role: 'admin', otpCode: otpPlain, expiresMinutes: 5 });

    res.json({ pending2fa: true, sessionId, maskedEmail: maskEmail(email.toLowerCase()) });
  } catch (e: any) {
    console.error('[admin/link-google]', e);
    res.status(500).json({ error: 'Erreur lors de la liaison du compte.' });
  }
});

// ── Admin: check if PIN is configured ────────────────────────────────────────
router.get('/api/admin/has-pin/:adminId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('admin_accounts').doc(req.params.adminId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Compte introuvable.' });
    res.json({ hasPin: !!snap.data()?.pinHash });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: set / change PIN ───────────────────────────────────────────────────
router.post('/api/admin/set-pin', requireDb, async (req, res) => {
  try {
    const { adminId, pin } = req.body;
    if (!adminId || !pin) return res.status(400).json({ error: 'adminId et pin requis.' });
    if (res.locals.adminSession?.adminId !== adminId) return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre code PIN.' });
    if (!/^\d{8}$/.test(String(pin))) return res.status(400).json({ error: 'Le PIN doit comporter exactement 8 chiffres.' });
    const snap = await adminDb.collection('admin_accounts').doc(adminId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Compte introuvable.' });
    await snap.ref.update({ pinHash: hashPin(String(pin)), updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: verify PIN (for sensitive operations) ──────────────────────────────
router.post('/api/admin/verify-pin', requireDb, async (req, res) => {
  try {
    const { adminId, pin } = req.body;
    if (!adminId || !pin) return res.status(400).json({ error: 'adminId et pin requis.' });
    if (res.locals.adminSession?.adminId !== adminId) return res.status(403).json({ error: 'Vous ne pouvez vérifier que votre propre code PIN.' });
    const snap = await adminDb.collection('admin_accounts').doc(adminId).get();
    if (!snap.exists) return res.status(404).json({ error: 'Compte introuvable.' });
    const data = snap.data()!;
    if (!data.pinHash) return res.status(403).json({ error: 'Code PIN non configuré.' });
    if (!verifyPin(String(pin), data.pinHash)) return res.status(401).json({ error: 'Code PIN incorrect.' });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Client: Update Google UID ─────────────────────────────────────────────────
router.post('/api/client/update-google-uid', requireDb, async (req, res) => {
  try {
    const { clientId, uid, photoUrl } = req.body;
    if (!clientId || !uid) return res.status(400).json({ error: 'Paramètres manquants.' });
    const updates: any = { uid, updatedAt: FieldValue.serverTimestamp() };
    if (photoUrl) updates.photoUrl = photoUrl;
    await adminDb.collection('clients').doc(clientId).update(updates);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─── Marché crypto manuel ─────────────────────────────────────────────────────
// This marketplace is intentionally isolated from crypto deposits and wallet
// accounting. A request merely records a manual fulfillment instruction.
const CRYPTO_MARKET_STATUSES = ['pending', 'processing', 'sent', 'rejected'] as const;
const SUPPORTED_CRYPTO_NETWORKS = ['TRC20', 'ERC20', 'BEP20', 'BTC'] as const;
const CRYPTO_ORDER_STATUSES = ['pending', 'payment_pending', 'payment_confirmed', 'processing', 'completed', 'cancelled', 'rejected'] as const;
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function normalizeCryptoNetworkCode(value: unknown): 'TRC20' | 'ERC20' | 'BEP20' | 'BTC' | 'SOL' | '' {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s_-]/g, '') : '';
  const aliases: Record<string, 'TRC20' | 'ERC20' | 'BEP20' | 'BTC' | 'SOL'> = {
    TRC20: 'TRC20', TRON: 'TRC20',
    ERC20: 'ERC20', ETHEREUM: 'ERC20', ETH: 'ERC20',
    BEP20: 'BEP20', BSC: 'BEP20', BINANCESMARTCHAIN: 'BEP20',
    BTC: 'BTC', BITCOIN: 'BTC',
    SOL: 'SOL', SOLANA: 'SOL',
  };
  return aliases[normalized] || '';
}

function normalizeCryptoMarketOffer(input: any): any {
  const assetName = typeof input?.assetName === 'string' ? input.assetName.trim() : '';
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  const networkName = typeof input?.networkName === 'string' ? input.networkName.trim() : '';
  const networkCode = typeof input?.networkCode === 'string' ? input.networkCode.trim().toUpperCase() : '';
  const feePercent = Number(input?.feePercent);
  const minAmountUSD = Number(input?.minAmountUSD);
  const maxAmountUSD = Number(input?.maxAmountUSD);
  const unitPriceUSD = Number(input?.unitPriceUSD);
  if (!assetName || assetName.length > 60 || !/^[A-Z0-9._-]{2,16}$/.test(symbol) || !networkName || networkName.length > 60 || !SUPPORTED_CRYPTO_NETWORKS.includes(networkCode as any)) {
    throw new Error('Actif ou réseau invalide.');
  }
  if (![feePercent, minAmountUSD, maxAmountUSD, unitPriceUSD].every(Number.isFinite) || feePercent < 0 || feePercent > 30 || minAmountUSD <= 0 || maxAmountUSD < minAmountUSD || maxAmountUSD > 1_000_000 || unitPriceUSD <= 0 || unitPriceUSD > 10_000_000) {
    throw new Error('Frais, limites ou cotation invalides.');
  }
  const color = typeof input?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(input.color) ? input.color : '#2563EB';
  const icon = typeof input?.icon === 'string' ? input.icon.trim().slice(0, 12) : '';
  return {
    assetName, symbol, networkName, networkCode,
    enabled: input?.enabled !== false,
    feePercent: Number(feePercent.toFixed(4)),
    minAmountUSD: Number(minAmountUSD.toFixed(2)),
    maxAmountUSD: Number(maxAmountUSD.toFixed(2)),
    unitPriceUSD: Number(unitPriceUSD.toFixed(8)),
    icon, color,
    quoteSource: input?.quoteSource === 'partner' ? 'partner' : 'manual',
  };
}

function decodeBase58(value: string): Buffer | null {
  let number = BigInt(0);
  for (const char of value) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index < 0) return null;
    number = number * BigInt(58) + BigInt(index);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = hex === '00' && number === BigInt(0) ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  const leadingZeros = value.match(/^1*/)?.[0].length || 0;
  return Buffer.concat([Buffer.alloc(leadingZeros), body]);
}

function isBase58Check(value: string, expectedVersion?: number): boolean {
  const decoded = decodeBase58(value);
  if (!decoded || decoded.length < 5) return false;
  const payload = decoded.subarray(0, -4);
  const checksum = decoded.subarray(-4);
  const expected = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4);
  return checksum.equals(expected) && (expectedVersion === undefined || payload[0] === expectedVersion);
}

function isValidBitcoinBech32(value: string): boolean {
  if (value.length < 14 || value.length > 90 || value !== value.toLowerCase()) return false;
  const separator = value.lastIndexOf('1');
  if (separator < 1 || separator + 7 > value.length || !value.startsWith('bc1')) return false;
  const charset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const data: number[] = [];
  for (const char of value.slice(separator + 1)) {
    const index = charset.indexOf(char);
    if (index < 0) return false;
    data.push(index);
  }
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const item of [...value.slice(0, separator)].map(char => char.charCodeAt(0) >> 5).concat([0], [...value.slice(0, separator)].map(char => char.charCodeAt(0) & 31), data)) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ item;
    generators.forEach((generator, index) => { if ((top >>> index) & 1) checksum ^= generator; });
  }
  const dataWithoutChecksum = data.slice(0, -6);
  const witnessVersion = dataWithoutChecksum[0];
  if (witnessVersion === undefined || witnessVersion > 16) return false;
  let accumulator = 0;
  let bits = 0;
  const witnessProgram: number[] = [];
  for (const item of dataWithoutChecksum.slice(1)) {
    accumulator = (accumulator << 5) | item;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      witnessProgram.push((accumulator >> bits) & 0xff);
    }
  }
  // A non-zero trailing padding would change the destination program.
  if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff) !== 0) return false;
  if (witnessProgram.length < 2 || witnessProgram.length > 40) return false;
  if (witnessVersion === 0 && witnessProgram.length !== 20 && witnessProgram.length !== 32) return false;
  return witnessVersion === 0 ? checksum === 1 : checksum === 0x2bc830a3;
}

function validateCryptoDestination(address: string, networkCode: string): boolean {
  if (!address || address.length < 20 || address.length > 160 || /\s/.test(address)) return false;
  const normalized = normalizeCryptoNetworkCode(networkCode);
  if (normalized === 'TRC20') return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) && isBase58Check(address, 0x41);
  if (normalized === 'ERC20' || normalized === 'BEP20') return /^0x[a-fA-F0-9]{40}$/.test(address);
  if (normalized === 'BTC') return isValidBitcoinBech32(address) || (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) && (isBase58Check(address, 0x00) || isBase58Check(address, 0x05)));
  if (normalized === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && decodeBase58(address)?.length === 32;
  return false;
}

function validateCryptoTransactionHash(hash: string, networkCode: string): boolean {
  const normalized = normalizeCryptoNetworkCode(networkCode);
  if (normalized === 'ERC20' || normalized === 'BEP20') return /^0x[a-fA-F0-9]{64}$/.test(hash);
  if (normalized === 'TRC20' || normalized === 'BTC') return /^[a-fA-F0-9]{64}$/.test(hash);
  if (normalized === 'SOL') return /^[1-9A-HJ-NP-Za-km-z]{43,88}$/.test(hash);
  return false;
}

function canonicalCryptoAddress(address: string, networkCode: string): string {
  // EVM addresses are case-insensitive. Bitcoin bech32 is normalized to lower
  // case, while Base58 and Tron remain case-sensitive by design.
  const normalized = normalizeCryptoNetworkCode(networkCode);
  if (normalized === 'ERC20' || normalized === 'BEP20' || (normalized === 'BTC' && address.startsWith('bc1'))) return address.toLowerCase();
  return address;
}

function cryptoRequestStatusMessage(status: string, symbol: string, note?: string): { title: string; message: string } {
  const suffix = note ? ` Note : ${note}` : '';
  if (status === 'processing') return { title: '🔄 Demande crypto en cours', message: `Votre demande ${symbol} est prise en charge par notre équipe.${suffix}` };
  if (status === 'sent') return { title: '✅ Crypto envoyée', message: `Votre demande ${symbol} a été finalisée. Vérifiez le hash de transaction dans son suivi.${suffix}` };
  return { title: '❌ Demande crypto refusée', message: `Votre demande ${symbol} n’a pas pu être finalisée.${suffix}` };
}

// ─── Commandes crypto manuelles — catalogue séparé ────────────────────────────
// These records remain separate from deposits and external blockchain handling.
// The branded-balance debit and any refund are nevertheless recorded atomically
// with the order so no browser-supplied amount can alter wallet accounting.
function normalizeCryptoAsset(input: any): any {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const symbol = typeof input?.symbol === 'string' ? input.symbol.trim().toUpperCase() : '';
  const coingeckoId = typeof input?.coingeckoId === 'string' ? input.coingeckoId.trim().toLowerCase() : '';
  const logo = typeof input?.logo === 'string' ? input.logo.trim().slice(0, 500) : '';
  if (!name || name.length > 80 || !/^[A-Z0-9._-]{2,16}$/.test(symbol) || !/^[a-z0-9-]{1,120}$/.test(coingeckoId)) {
    throw new Error('Les informations de la crypto sont invalides.');
  }
  if (logo && !/^https:\/\//i.test(logo)) throw new Error('Le logo doit utiliser une URL HTTPS.');
  const feePercent = Number(input?.feePercent ?? 2);
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 30) {
    throw new Error('Les frais doivent être compris entre 0 % et 30 %.');
  }
  return { name, symbol, coingeckoId, logo, feePercent: Number(feePercent.toFixed(4)), enabled: input?.enabled !== false };
}

function normalizeCryptoNetwork(input: any, crypto: any): any {
  const networkName = typeof input?.networkName === 'string' ? input.networkName.trim() : '';
  const requestedCode = typeof input?.networkCode === 'string' ? input.networkCode.trim().toUpperCase() : '';
  const canonicalCode = normalizeCryptoNetworkCode(requestedCode);
  const walletAddress = typeof input?.walletAddress === 'string' ? input.walletAddress.trim() : '';
  if (!networkName || networkName.length > 80 || !canonicalCode || !walletAddress || !validateCryptoDestination(walletAddress, canonicalCode)) {
    throw new Error('Le réseau ou l’adresse wallet administrateur est invalide.');
  }
  return {
    cryptoId: String(crypto.id || input.cryptoId || ''),
    cryptoSymbol: String(crypto.symbol || '').toUpperCase(),
    networkName,
    // Store a canonical code; the human label remains networkName.
    networkCode: canonicalCode,
    walletAddress: canonicalCryptoAddress(walletAddress, canonicalCode),
    enabled: input?.enabled !== false,
  };
}

function publicCryptoNetwork(network: any): any {
  const { walletAddress: _walletAddress, ...publicNetwork } = network;
  return publicNetwork;
}

function clientCryptoOrder(order: any): any {
  // Internal settlement metadata must never cross the client API boundary.
  // `walletAddress` is intentionally retained: it is the client's requested
  // receiving address, whereas networkWalletAddress is an operational address.
  const {
    networkWalletAddress: _networkWalletAddress,
    normalizedWalletAddress: _normalizedWalletAddress,
    dedupeId: _dedupeId,
    processedBy: _processedBy,
    ...clientOrder
  } = order;
  return clientOrder;
}

function orderStatusMessage(status: string, symbol: string, note?: string): { title: string; message: string } {
  const suffix = note ? ` Note : ${note}` : '';
  if (status === 'payment_pending') return { title: '⏳ Paiement à confirmer', message: `Votre commande ${symbol} attend la confirmation de paiement.${suffix}` };
  if (status === 'payment_confirmed') return { title: '✅ Paiement confirmé', message: `Le paiement de votre commande ${symbol} est confirmé.${suffix}` };
  if (status === 'processing') return { title: '🔄 Commande crypto en cours', message: `Votre commande ${symbol} est en préparation par notre équipe.${suffix}` };
  if (status === 'completed') return { title: '✅ Commande crypto finalisée', message: `Votre commande ${symbol} est finalisée. Consultez le hash dans votre suivi.${suffix}` };
  if (status === 'cancelled') return { title: 'Commande crypto annulée', message: `Votre commande ${symbol} a été annulée. Votre solde Solutionpam a été remboursé automatiquement.${suffix}` };
  return { title: '❌ Commande crypto refusée', message: `Votre commande ${symbol} n’a pas pu être finalisée. Votre solde Solutionpam a été remboursé automatiquement.${suffix}` };
}

const DEFAULT_CRYPTO_ASSETS = [
  { id: 'starter-bitcoin', name: 'Bitcoin', symbol: 'BTC', coingeckoId: 'bitcoin' },
  { id: 'starter-ethereum', name: 'Ethereum', symbol: 'ETH', coingeckoId: 'ethereum' },
  { id: 'starter-tether', name: 'Tether USD', symbol: 'USDT', coingeckoId: 'tether' },
  { id: 'starter-usd-coin', name: 'USD Coin', symbol: 'USDC', coingeckoId: 'usd-coin' },
  { id: 'starter-solana', name: 'Solana', symbol: 'SOL', coingeckoId: 'solana' },
  { id: 'starter-bnb', name: 'BNB', symbol: 'BNB', coingeckoId: 'binancecoin' },
];

async function ensureDefaultCryptoAssets(): Promise<void> {
  // Seed only once. A separate marker means an administrator can later choose
  // to disable or remove every crypto without the public catalogue recreating it.
  const markerRef = adminDb.collection('crypto_catalog_meta').doc('starter_assets_v1');
  const marker = await markerRef.get();
  if (marker.exists) return;
  const batch = adminDb.batch();
  for (const asset of DEFAULT_CRYPTO_ASSETS) {
    batch.set(adminDb.collection('cryptos').doc(asset.id), {
      name: asset.name, symbol: asset.symbol, logo: '', coingeckoId: asset.coingeckoId,
      enabled: true, priceUSD: null, feePercent: 2, starterAsset: true,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  batch.set(markerRef, { seededAt: FieldValue.serverTimestamp(), assetCount: DEFAULT_CRYPTO_ASSETS.length });
  await batch.commit();
}

async function getCryptoCatalog(includeDisabled = false): Promise<{ cryptos: any[]; networks: any[] }> {
  await ensureDefaultCryptoAssets();
  const [cryptoSnap, networkSnap] = await Promise.all([
    adminDb.collection('cryptos').get(),
    adminDb.collection('crypto_networks').get(),
  ]);
  const cryptos = cryptoSnap.docs.map(serializeDoc)
    .filter(crypto => includeDisabled || crypto.enabled === true)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const cryptoIds = new Set(cryptos.map(crypto => crypto.id));
  const networks = networkSnap.docs.map(serializeDoc)
    .filter(network => cryptoIds.has(network.cryptoId) && (includeDisabled || network.enabled === true))
    .sort((a, b) => `${a.cryptoSymbol}-${a.networkName}`.localeCompare(`${b.cryptoSymbol}-${b.networkName}`));
  return { cryptos, networks };
}

router.get('/api/crypto-orders/catalog', requireDb, async (_req, res) => {
  try {
    const { cryptos, networks } = await getCryptoCatalog(false);
    res.json({ cryptos, networks: networks.map(publicCryptoNetwork) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Impossible de charger le catalogue crypto.' });
  }
});

router.get('/api/client/crypto-orders', requireDb, requireClientSession, async (_req, res) => {
  try {
    const userId = String(res.locals.clientSession.clientId);
    const snap = await adminDb.collection('crypto_orders').where('userId', '==', userId).limit(200).get();
    res.json({ orders: snap.docs.map(doc => clientCryptoOrder(serializeDoc(doc))).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0)) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Impossible de charger vos commandes crypto.' });
  }
});

router.get('/api/client/crypto-orders/:id', requireDb, requireClientSession, async (req, res) => {
  try {
    const order = await adminDb.collection('crypto_orders').doc(req.params.id).get();
    if (!order.exists || order.data()?.userId !== res.locals.clientSession.clientId) return res.status(404).json({ error: 'Commande introuvable.' });
    res.json({ order: clientCryptoOrder(serializeDoc(order)) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Impossible de charger cette commande.' });
  }
});

router.post('/api/client/crypto-orders', requireDb, requireClientSession, blockNewCryptoClientOrders, async (req, res) => {
  try {
    const cryptoId = typeof req.body?.cryptoId === 'string' ? req.body.cryptoId.trim() : '';
    const networkId = typeof req.body?.networkId === 'string' ? req.body.networkId.trim() : '';
    const amount = Number(req.body?.amount);
    const walletAddress = typeof req.body?.walletAddress === 'string' ? req.body.walletAddress.trim() : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!cryptoId || !networkId || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000 || req.body?.consent !== true || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Les informations de la commande sont incomplètes.' });
    }
    const userId = String(res.locals.clientSession.clientId);
    const orderRef = adminDb.collection('crypto_orders').doc();
    const auditRef = adminDb.collection('crypto_order_audit').doc();
    const paymentTransactionRef = adminDb.collection('client_transactions').doc();
    const idempotencyRef = adminDb.collection('crypto_order_idempotency').doc(createHash('sha256').update(`${userId}|${idempotencyKey}`).digest('hex'));
    const clientRef = adminDb.collection('clients').doc(userId);
    let createdOrder: any;
    let existingOrderId = '';

    await adminDb.runTransaction(async transaction => {
      const [cryptoSnap, networkSnap, idempotencySnap, clientSnap] = await Promise.all([
        transaction.get(adminDb.collection('cryptos').doc(cryptoId)),
        transaction.get(adminDb.collection('crypto_networks').doc(networkId)),
        transaction.get(idempotencyRef),
        transaction.get(clientRef),
      ]);
      if (idempotencySnap.exists) {
        existingOrderId = String(idempotencySnap.data()?.orderId || '');
        if (existingOrderId) return;
        throw new Error('Clé de commande invalide.');
      }
      if (!cryptoSnap.exists || cryptoSnap.data()?.enabled !== true) throw new Error('Cette crypto n’est plus disponible.');
      if (!networkSnap.exists) throw new Error('Ce réseau n’est plus disponible.');
      if (!clientSnap.exists || clientSnap.data()?.status === 'blocked') throw new Error('Compte client indisponible.');
      const cryptoAsset: any = { id: cryptoSnap.id, ...(cryptoSnap.data() || {}) };
      const network: any = { id: networkSnap.id, ...(networkSnap.data() || {}) };
      if (network.cryptoId !== cryptoAsset.id || network.enabled !== true) throw new Error('Ce réseau n’est pas disponible pour cette crypto.');
      if (!validateCryptoDestination(walletAddress, network.networkCode)) throw new Error(`Cette adresse ne correspond pas au réseau ${network.networkName}.`);
      const priceUSD = Number(cryptoAsset.priceUSD);
      const feePercent = Number(cryptoAsset.feePercent ?? 2);
      if (!Number.isFinite(priceUSD) || priceUSD <= 0) throw new Error('Le prix indicatif de cette crypto est indisponible. Réessayez après une synchronisation.');
      if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 30) throw new Error('La configuration des frais de cette crypto est invalide.');
      const cryptoSubtotalUSD = Number((amount * priceUSD).toFixed(2));
      const feeAmountUSD = Number((cryptoSubtotalUSD * feePercent / 100).toFixed(2));
      const totalUSD = Number((cryptoSubtotalUSD + feeAmountUSD).toFixed(2));
      if (!Number.isFinite(totalUSD) || totalUSD <= 0 || totalUSD > 10_000_000) throw new Error('Le total de la commande est invalide.');
      const clientData = clientSnap.data() || {};
      const balance = Number(clientData.balance);
      if (!Number.isFinite(balance) || balance < totalUSD) throw new Error(`Solde insuffisant. Cette commande nécessite ${totalUSD.toFixed(2)} USD.`);
      const normalizedAddress = canonicalCryptoAddress(walletAddress, network.networkCode);
      const dedupeId = createHash('sha256').update(`${userId}|${cryptoAsset.id}|${network.id}|${normalizedAddress}`).digest('hex');
      const dedupeRef = adminDb.collection('crypto_order_dedupes').doc(dedupeId);
      const dedupeSnap = await transaction.get(dedupeRef);
      if (dedupeSnap.exists && dedupeSnap.data()?.active === true) throw new Error('Une commande active existe déjà pour cette adresse, cette crypto et ce réseau.');
      const orderNumber = `CR-${Date.now().toString(36).toUpperCase()}-${orderRef.id.slice(0, 5).toUpperCase()}`;
      createdOrder = {
        id: orderRef.id, orderNumber, userId,
        clientName: String(clientData.name || 'Client Solutionpam').slice(0, 120),
        phone: String(clientData.phone || clientData.phoneNumber || '').slice(0, 40),
        email: String(clientData.email || '').slice(0, 160),
        cryptoId: cryptoAsset.id, cryptoName: cryptoAsset.name, cryptoSymbol: cryptoAsset.symbol, cryptoLogo: cryptoAsset.logo || '',
        networkId: network.id, networkName: network.networkName, networkCode: network.networkCode,
        amount: Number(amount.toFixed(12)), walletAddress, normalizedWalletAddress: normalizedAddress,
        status: 'payment_confirmed', paymentStatus: 'confirmed',
        priceUSD, priceUpdatedAt: cryptoAsset.priceUpdatedAt || null,
        cryptoSubtotalUSD, feePercent, feeAmountUSD, totalUSD,
        paymentTransactionId: paymentTransactionRef.id, consentedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), dedupeId,
      };
      transaction.set(orderRef, createdOrder);
      transaction.update(clientRef, { balance: FieldValue.increment(-totalUSD), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(paymentTransactionRef, {
        clientId: userId, clientName: createdOrder.clientName, type: 'crypto_purchase',
        amount: totalUSD, usdAmount: totalUSD, status: 'completed', method: 'rena_balance',
        description: `Achat crypto ${createdOrder.amount} ${createdOrder.cryptoSymbol} · ${orderNumber}`,
        cryptoOrderId: orderRef.id, orderNumber, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(dedupeRef, { active: true, orderId: orderRef.id, userId, cryptoId, networkId, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(idempotencyRef, { orderId: orderRef.id, userId, createdAt: FieldValue.serverTimestamp() });
      transaction.set(auditRef, { orderId: orderRef.id, userId, actorType: 'client', actorId: userId, action: 'created_and_debited', fromStatus: null, toStatus: 'payment_confirmed', paymentTransactionId: paymentTransactionRef.id, totalUSD, createdAt: FieldValue.serverTimestamp() });
    });

    if (existingOrderId) {
      const existing = await adminDb.collection('crypto_orders').doc(existingOrderId).get();
      if (!existing.exists) return res.status(409).json({ error: 'Commande en cours de synchronisation. Réessayez dans un instant.' });
      const currentClient = await clientRef.get();
      return res.json({ order: clientCryptoOrder(serializeDoc(existing)), balanceAfter: Number(currentClient.data()?.balance || 0), idempotent: true });
    }
    await adminDb.collection('admin_notifications').add({
      type: 'crypto_order', title: 'Nouvelle commande crypto',
      message: `${createdOrder.clientName} demande ${createdOrder.amount} ${createdOrder.cryptoSymbol} sur ${createdOrder.networkName}.`,
      clientId: userId, orderId: orderRef.id, read: false, createdAt: FieldValue.serverTimestamp(),
    });
    sendFcmToClient(userId, '✅ Paiement crypto confirmé', 'Votre solde Solutionpam a été débité. Notre équipe prépare votre envoi.', { type: 'crypto_order', orderId: orderRef.id });
    pushClientEvent(userId, 'crypto_order_created', { id: orderRef.id, status: 'payment_confirmed' });
    const [created, currentClient] = await Promise.all([orderRef.get(), clientRef.get()]);
    res.status(201).json({ order: clientCryptoOrder(serializeDoc(created)), balanceAfter: Number(currentClient.data()?.balance || 0) });
  } catch (e: any) {
    const message = e.message || 'Impossible de créer la commande.';
    res.status(/incomplètes|disponible|adresse ne correspond|commande active|invalide|insuffisant|indisponible|compte client/.test(message) ? 400 : 500).json({ error: message });
  }
});

router.get('/api/admin/crypto-orders/catalog', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (_req, res) => {
  try { res.json(await getCryptoCatalog(true)); }
  catch (e: any) { res.status(500).json({ error: e.message || 'Impossible de charger le catalogue crypto.' }); }
});

router.post('/api/admin/crypto-orders/cryptos', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const { id } = req.body || {};
    const asset = normalizeCryptoAsset(req.body);
    if (id) {
      const ref = adminDb.collection('cryptos').doc(String(id));
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'Crypto introuvable.' });
      await ref.update({ ...asset, updatedAt: FieldValue.serverTimestamp(), updatedBy: res.locals.adminSession?.adminId || '' });
      return res.json({ id: ref.id });
    }
    const ref = await adminDb.collection('cryptos').add({ ...asset, priceUSD: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: res.locals.adminSession?.adminId || '' });
    res.status(201).json({ id: ref.id });
  } catch (e: any) { res.status(400).json({ error: e.message || 'Crypto invalide.' }); }
});

router.post('/api/admin/crypto-orders/networks', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const { id } = req.body || {};
    const cryptoId = typeof req.body?.cryptoId === 'string' ? req.body.cryptoId : '';
    const cryptoSnap = await adminDb.collection('cryptos').doc(cryptoId).get();
    if (!cryptoSnap.exists) return res.status(400).json({ error: 'La crypto sélectionnée est introuvable.' });
    const network = normalizeCryptoNetwork(req.body, { id: cryptoSnap.id, ...cryptoSnap.data() });
    if (id) {
      const ref = adminDb.collection('crypto_networks').doc(String(id));
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'Réseau introuvable.' });
      await ref.update({ ...network, updatedAt: FieldValue.serverTimestamp(), updatedBy: res.locals.adminSession?.adminId || '' });
      return res.json({ id: ref.id });
    }
    const ref = await adminDb.collection('crypto_networks').add({ ...network, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: res.locals.adminSession?.adminId || '' });
    res.status(201).json({ id: ref.id });
  } catch (e: any) { res.status(400).json({ error: e.message || 'Réseau crypto invalide.' }); }
});

router.get('/api/admin/crypto-orders/orders', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !CRYPTO_ORDER_STATUSES.includes(status as any)) return res.status(400).json({ error: 'Statut invalide.' });
    let query: FirebaseFirestore.Query = adminDb.collection('crypto_orders');
    if (status) query = query.where('status', '==', status);
    const snap = await query.limit(500).get();
    res.json({ orders: snap.docs.map(serializeDoc).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0)) });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Impossible de charger les commandes.' }); }
});

router.patch('/api/admin/crypto-orders/orders/:id', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 1000) : '';
    const transactionHash = typeof req.body?.transactionHash === 'string' ? req.body.transactionHash.trim().slice(0, 256) : '';
    if (!CRYPTO_ORDER_STATUSES.includes(nextStatus as any)) return res.status(400).json({ error: 'Statut invalide.' });
    const orderRef = adminDb.collection('crypto_orders').doc(req.params.id);
    const auditRef = adminDb.collection('crypto_order_audit').doc();
    const refundTransactionRef = adminDb.collection('client_transactions').doc();
    let updated: any;
    await adminDb.runTransaction(async transaction => {
      const snap = await transaction.get(orderRef);
      if (!snap.exists) throw new Error('Commande introuvable.');
      const current = snap.data()!;
      const allowed: Record<string, string[]> = {
        pending: ['payment_pending', 'payment_confirmed', 'processing', 'cancelled', 'rejected'],
        payment_pending: ['payment_confirmed', 'cancelled', 'rejected'],
        payment_confirmed: ['processing', 'cancelled', 'rejected'],
        processing: ['completed', 'cancelled', 'rejected'],
        completed: [], cancelled: [], rejected: [],
      };
      if (!allowed[current.status]?.includes(nextStatus)) throw new Error('Cette transition de statut n’est pas autorisée.');
      if (nextStatus === 'payment_confirmed' && !current.paymentTransactionId) {
        throw new Error('Cette commande historique n’a pas été réglée depuis le solde Solutionpam.');
      }
      if (nextStatus === 'completed' && !validateCryptoTransactionHash(transactionHash, String(current.networkCode || ''))) {
        throw new Error('Le hash de transaction est requis et doit correspondre au réseau de la commande.');
      }
      const requiresRefund = ['cancelled', 'rejected'].includes(nextStatus)
        && current.paymentStatus === 'confirmed'
        && typeof current.paymentTransactionId === 'string'
        && !current.refundTransactionId;
      let refundAmount = 0;
      if (requiresRefund) {
        refundAmount = Number(current.totalUSD);
        if (!Number.isFinite(refundAmount) || refundAmount <= 0) throw new Error('Le montant du remboursement est invalide.');
        const clientSnap = await transaction.get(adminDb.collection('clients').doc(String(current.userId)));
        if (!clientSnap.exists) throw new Error('Client introuvable pour le remboursement.');
      }
      const updates: any = {
        status: nextStatus, updatedAt: FieldValue.serverTimestamp(), processedBy: res.locals.adminSession?.adminId || '',
        ...(adminNote ? { adminNote } : {}), ...(transactionHash ? { transactionHash } : {}),
        ...(nextStatus === 'completed' ? { completedAt: FieldValue.serverTimestamp() } : {}),
        ...(nextStatus === 'cancelled' ? { cancelledAt: FieldValue.serverTimestamp() } : {}),
        ...(nextStatus === 'rejected' ? { rejectedAt: FieldValue.serverTimestamp() } : {}),
        ...(requiresRefund ? { paymentStatus: 'refunded', refundTransactionId: refundTransactionRef.id, refundedAt: FieldValue.serverTimestamp() } : {}),
      };
      transaction.update(orderRef, updates);
      if (requiresRefund) {
        const clientRef = adminDb.collection('clients').doc(String(current.userId));
        transaction.update(clientRef, { balance: FieldValue.increment(refundAmount), updatedAt: FieldValue.serverTimestamp() });
        transaction.set(refundTransactionRef, {
          clientId: current.userId, clientName: current.clientName || '', type: 'crypto_refund',
          amount: refundAmount, usdAmount: refundAmount, status: 'completed', method: 'rena_balance',
          description: `Remboursement commande crypto ${current.orderNumber || orderRef.id}`,
          cryptoOrderId: orderRef.id, orderNumber: current.orderNumber || '', relatedTransactionId: current.paymentTransactionId,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      }
      if (['completed', 'cancelled', 'rejected'].includes(nextStatus) && current.dedupeId) {
        transaction.update(adminDb.collection('crypto_order_dedupes').doc(current.dedupeId), { active: false, updatedAt: FieldValue.serverTimestamp() });
      }
      transaction.set(auditRef, {
        orderId: orderRef.id, userId: current.userId, actorType: 'admin', actorId: res.locals.adminSession?.adminId || '',
        action: requiresRefund ? 'status_changed_and_refunded' : 'status_changed',
        fromStatus: current.status, toStatus: nextStatus, note: adminNote || null, transactionHash: transactionHash || null,
        ...(requiresRefund ? { refundTransactionId: refundTransactionRef.id, refundAmount } : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
      updated = { id: orderRef.id, ...current, ...updates };
    });
    const notification = orderStatusMessage(nextStatus, updated.cryptoSymbol || 'crypto', adminNote);
    await adminDb.collection('client_notifications').add({ clientId: updated.userId, type: 'crypto_order', title: notification.title, message: notification.message, orderId: orderRef.id, read: false, createdAt: FieldValue.serverTimestamp() });
    sendFcmToClient(updated.userId, notification.title, notification.message, { type: 'crypto_order', orderId: orderRef.id, status: nextStatus });
    pushClientEvent(updated.userId, 'crypto_order_updated', { id: orderRef.id, status: nextStatus });
    res.json({ order: updated });
  } catch (e: any) {
    const message = e.message || 'Mise à jour impossible.';
    res.status(/introuvable|autorisée|requis|correspondre/.test(message) ? 400 : 500).json({ error: message });
  }
});

router.post('/api/admin/crypto-orders/sync-coingecko', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (_req, res) => {
  try {
    const cryptoSnap = await adminDb.collection('cryptos').get();
    const assets: any[] = cryptoSnap.docs
      .map(doc => ({ id: doc.id, ...((doc.data() || {}) as any) }))
      .filter((asset: any) => asset.coingeckoId);
    if (!assets.length) return res.json({ synced: 0, failed: 0 });
    const ids = assets.map(asset => encodeURIComponent(String(asset.coingeckoId))).join(',');
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=250&page=1&sparkline=false`, { headers });
    if (!response.ok) throw new Error(`CoinGecko a répondu ${response.status}.`);
    const quotes = await response.json() as Array<{ id: string; current_price?: number; image?: string; name?: string; symbol?: string }>;
    const byId = new Map(quotes.map(quote => [quote.id, quote]));
    const batch = adminDb.batch();
    let synced = 0;
    for (const asset of assets) {
      const quote = byId.get(String(asset.coingeckoId));
      if (!quote || !Number.isFinite(Number(quote.current_price))) continue;
      batch.update(adminDb.collection('cryptos').doc(asset.id), {
        priceUSD: Number(quote.current_price), priceUpdatedAt: FieldValue.serverTimestamp(),
        ...(quote.image && !asset.logo ? { logo: quote.image } : {}), updatedAt: FieldValue.serverTimestamp(),
      });
      synced++;
    }
    if (synced) await batch.commit();
    res.json({ synced, failed: assets.length - synced });
  } catch (e: any) { res.status(502).json({ error: e.message || 'Synchronisation CoinGecko impossible.' }); }
});

router.post('/api/admin/crypto-orders/migrate-legacy', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (_req, res) => {
  try {
    // The source collections are never changed. Deterministic IDs make this
    // operation safe to retry if a deployment is interrupted.
    const [offerSnap, requestSnap] = await Promise.all([
      adminDb.collection('crypto_market_offers').get(),
      adminDb.collection('crypto_market_requests').get(),
    ]);
    const cryptoByLegacyKey = new Map<string, any>();
    const networkByLegacyKey = new Map<string, any>();
    let cryptosCreated = 0; let networksCreated = 0; let ordersCreated = 0;

    for (const offerDoc of offerSnap.docs) {
      const offer = offerDoc.data();
      const symbol = String(offer.symbol || '').trim().toUpperCase();
      const networkCode = normalizeCryptoNetworkCode(offer.networkCode);
      if (!symbol || !networkCode) continue;
      const cryptoId = `legacy-${createHash('sha256').update(symbol).digest('hex').slice(0, 20)}`;
      const networkId = `legacy-${createHash('sha256').update(`${symbol}|${networkCode}`).digest('hex').slice(0, 20)}`;
      const cryptoRef = adminDb.collection('cryptos').doc(cryptoId);
      const networkRef = adminDb.collection('crypto_networks').doc(networkId);
      if (!(await cryptoRef.get()).exists) {
        await cryptoRef.set({
          name: String(offer.assetName || symbol).slice(0, 80), symbol, logo: '', coingeckoId: 'legacy-unconfigured',
          enabled: offer.enabled === true, priceUSD: Number.isFinite(Number(offer.unitPriceUSD)) ? Number(offer.unitPriceUSD) : null,
          migratedFrom: 'crypto_market_offers', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
        cryptosCreated++;
      }
      // Legacy offers did not store an operational wallet. They are retained as
      // disabled network records until an administrator provides one.
      if (!(await networkRef.get()).exists) {
        await networkRef.set({
          cryptoId, cryptoSymbol: symbol, networkName: String(offer.networkName || networkCode).slice(0, 80), networkCode,
          walletAddress: '', enabled: false, migratedFrom: 'crypto_market_offers', requiresWalletConfiguration: true,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
        networksCreated++;
      }
      cryptoByLegacyKey.set(symbol, { id: cryptoId, name: String(offer.assetName || symbol), symbol, logo: '', priceUSD: offer.unitPriceUSD });
      networkByLegacyKey.set(`${symbol}|${networkCode}`, { id: networkId, name: String(offer.networkName || networkCode), code: networkCode });
    }

    for (const legacyDoc of requestSnap.docs) {
      const legacy = legacyDoc.data();
      const snapshot = legacy.offerSnapshot || {};
      const symbol = String(snapshot.symbol || '').trim().toUpperCase();
      const networkCode = normalizeCryptoNetworkCode(snapshot.networkCode);
      const crypto = cryptoByLegacyKey.get(symbol);
      const network = networkByLegacyKey.get(`${symbol}|${networkCode}`);
      if (!crypto || !network) continue;
      const ref = adminDb.collection('crypto_orders').doc(`legacy-${legacyDoc.id}`);
      if ((await ref.get()).exists) continue;
      const statusMap: Record<string, string> = { pending: 'pending', processing: 'processing', sent: 'completed', rejected: 'rejected' };
      await ref.set({
        orderNumber: `LEGACY-${legacyDoc.id.slice(0, 8).toUpperCase()}`, userId: String(legacy.clientId || ''),
        clientName: String(legacy.clientName || 'Client Solutionpam'), phone: '', email: String(legacy.clientEmail || ''),
        cryptoId: crypto.id, cryptoName: crypto.name, cryptoSymbol: crypto.symbol, cryptoLogo: '',
        networkId: network.id, networkName: network.name, networkCode: network.code,
        amount: Number.isFinite(Number(legacy.estimatedCryptoAmount)) ? Number(legacy.estimatedCryptoAmount) : 0,
        walletAddress: String(legacy.destinationAddress || ''), normalizedWalletAddress: String(legacy.normalizedDestinationAddress || ''),
        status: statusMap[String(legacy.status)] || 'pending', adminNote: legacy.adminNote || '',
        transactionHash: legacy.transactionHash || '', priceUSD: Number.isFinite(Number(snapshot.unitPriceUSD)) ? Number(snapshot.unitPriceUSD) : null,
        legacyRequestId: legacyDoc.id, legacyOfferSnapshot: snapshot, migratedFrom: 'crypto_market_requests',
        createdAt: legacy.createdAt || FieldValue.serverTimestamp(), updatedAt: legacy.updatedAt || FieldValue.serverTimestamp(),
        ...(legacy.completedAt ? { completedAt: legacy.completedAt } : {}), ...(legacy.rejectedAt ? { rejectedAt: legacy.rejectedAt } : {}),
      });
      ordersCreated++;
    }
    res.json({ cryptos: cryptosCreated, networks: networksCreated, orders: ordersCreated });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Migration historique impossible.' }); }
});

router.get('/api/crypto-market/offers', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('crypto_market_offers').where('enabled', '==', true).get();
    const offers = snap.docs.map(serializeDoc).sort((a, b) => `${a.assetName}-${a.networkName}`.localeCompare(`${b.assetName}-${b.networkName}`));
    res.json({ offers });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Impossible de charger le marché crypto.' });
  }
});

router.get('/api/client/crypto-market/requests', requireDb, requireClientSession, async (_req, res) => {
  try {
    const clientId = res.locals.clientSession.clientId;
    const snap = await adminDb.collection('crypto_market_requests').where('clientId', '==', clientId).limit(100).get();
    const requests = snap.docs.map(serializeDoc).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
    res.json({ requests });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Impossible de charger vos demandes.' });
  }
});

router.post('/api/client/crypto-market/requests', requireDb, requireClientSession, blockNewCryptoClientOrders, async (req, res) => {
  try {
    const offerId = typeof req.body?.offerId === 'string' ? req.body.offerId : '';
    const amountUSD = Number(req.body?.amountUSD);
    const destinationAddress = typeof req.body?.destinationAddress === 'string' ? req.body.destinationAddress.trim() : '';
    const idempotencyKey = typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    if (!offerId || !Number.isFinite(amountUSD) || amountUSD <= 0 || req.body?.consent !== true || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Les informations de demande sont incomplètes.' });
    }
    const clientId = res.locals.clientSession.clientId as string;
    const clientData = res.locals.clientRecord.data() || {};
    const requestRef = adminDb.collection('crypto_market_requests').doc();
    const auditRef = adminDb.collection('crypto_market_audit').doc();
    const idempotencyRef = adminDb.collection('crypto_market_idempotency').doc(createHash('sha256').update(`${clientId}|${idempotencyKey}`).digest('hex'));
    let requestData: any;
    let existingRequestId = '';

    await adminDb.runTransaction(async transaction => {
      const [offerSnap, idempotencySnap] = await Promise.all([
        transaction.get(adminDb.collection('crypto_market_offers').doc(offerId)),
        transaction.get(idempotencyRef),
      ]);
      if (idempotencySnap.exists) {
        existingRequestId = String(idempotencySnap.data()?.requestId || '');
        if (existingRequestId) return;
        throw new Error('Clé de demande invalide.');
      }
      if (!offerSnap.exists) throw new Error('Cette offre n’est plus disponible.');
      const offer = normalizeCryptoMarketOffer({ ...offerSnap.data(), enabled: offerSnap.data()?.enabled });
      if (!offer.enabled) throw new Error('Cette offre est temporairement indisponible.');
      if (amountUSD < offer.minAmountUSD || amountUSD > offer.maxAmountUSD) throw new Error(`Montant autorisé : ${offer.minAmountUSD} à ${offer.maxAmountUSD} USD.`);
      if (!validateCryptoDestination(destinationAddress, offer.networkCode)) throw new Error(`Cette adresse ne correspond pas au réseau ${offer.networkName}.`);
      const normalizedAddress = canonicalCryptoAddress(destinationAddress, offer.networkCode);
      const dedupeId = createHash('sha256').update(`${clientId}|${offer.symbol}|${offer.networkCode}|${normalizedAddress}`).digest('hex');
      const dedupeRef = adminDb.collection('crypto_market_request_dedupes').doc(dedupeId);
      const dedupeSnap = await transaction.get(dedupeRef);
      if (dedupeSnap.exists && dedupeSnap.data()?.active === true) throw new Error('Une demande active existe déjà pour cette adresse et cet actif.');

      const feeAmountUSD = Number((amountUSD * offer.feePercent / 100).toFixed(2));
      const totalUSD = Number((amountUSD + feeAmountUSD).toFixed(2));
      const estimatedCryptoAmount = Number((amountUSD / offer.unitPriceUSD).toFixed(8));
      const offerSnapshot = { id: offerId, ...offer };
      requestData = {
        id: requestRef.id,
        clientId,
        clientName: String(clientData.name || 'Client Solutionpam'),
        clientEmail: String(clientData.email || ''),
        status: 'pending',
        destinationAddress,
        normalizedDestinationAddress: normalizedAddress,
        amountUSD: Number(amountUSD.toFixed(2)),
        feeAmountUSD,
        totalUSD,
        estimatedCryptoAmount,
        offerSnapshot,
        consentedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        dedupeId,
      };
      transaction.set(requestRef, requestData);
      transaction.set(dedupeRef, { active: true, requestId: requestRef.id, clientId, offerId, updatedAt: FieldValue.serverTimestamp() });
      transaction.set(idempotencyRef, { requestId: requestRef.id, clientId, createdAt: FieldValue.serverTimestamp() });
      transaction.set(auditRef, {
        requestId: requestRef.id, clientId, actorType: 'client', actorId: clientId,
        action: 'created', fromStatus: null, toStatus: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (existingRequestId) {
      const existing = await adminDb.collection('crypto_market_requests').doc(existingRequestId).get();
      if (!existing.exists) return res.status(409).json({ error: 'Demande en cours de synchronisation. Réessayez dans un instant.' });
      return res.json({ request: serializeDoc(existing), idempotent: true });
    }

    await adminDb.collection('admin_notifications').add({
      type: 'crypto_market_request',
      title: 'Nouvelle demande crypto',
      message: `${requestData.clientName} demande ${requestData.offerSnapshot.symbol} (${requestData.amountUSD.toFixed(2)} USD).`,
      clientId,
      requestId: requestRef.id,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    sendFcmToClient(clientId, '✅ Demande crypto reçue', 'Votre demande est en attente de traitement (15 à 30 minutes).', { type: 'crypto_market', requestId: requestRef.id });
    pushClientEvent(clientId, 'crypto_market_created', { id: requestRef.id, status: 'pending' });
    const created = await requestRef.get();
    res.status(201).json({ request: serializeDoc(created) });
  } catch (e: any) {
    const status = /incomplètes|autorisé|adresse ne correspond|demande active|indisponible/.test(String(e.message)) ? 400 : 500;
    res.status(status).json({ error: e.message || 'Impossible de créer la demande.' });
  }
});

router.get('/api/admin/crypto-market/offers', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (_req, res) => {
  try {
    const snap = await adminDb.collection('crypto_market_offers').get();
    res.json({ offers: snap.docs.map(serializeDoc).sort((a, b) => `${a.assetName}-${a.networkName}`.localeCompare(`${b.assetName}-${b.networkName}`)) });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Erreur catalogue crypto.' }); }
});

router.post('/api/admin/crypto-market/offers', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const { id } = req.body || {};
    const offer = normalizeCryptoMarketOffer(req.body);
    const adminId = res.locals.adminSession?.adminId || '';
    if (id) {
      const ref = adminDb.collection('crypto_market_offers').doc(String(id));
      if (!(await ref.get()).exists) return res.status(404).json({ error: 'Offre introuvable.' });
      await ref.update({ ...offer, quoteUpdatedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), updatedBy: adminId });
      return res.json({ id: ref.id });
    }
    const ref = await adminDb.collection('crypto_market_offers').add({
      ...offer, quoteUpdatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), createdBy: adminId,
    });
    res.status(201).json({ id: ref.id });
  } catch (e: any) { res.status(400).json({ error: e.message || 'Offre crypto invalide.' }); }
});

router.delete('/api/admin/crypto-market/offers/:id', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    await adminDb.collection('crypto_market_offers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Suppression impossible.' }); }
});

router.get('/api/admin/crypto-market/requests', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (status && !CRYPTO_MARKET_STATUSES.includes(status as any)) return res.status(400).json({ error: 'Statut invalide.' });
    let query: FirebaseFirestore.Query = adminDb.collection('crypto_market_requests');
    if (status) query = query.where('status', '==', status);
    const snap = await query.limit(500).get();
    res.json({ requests: snap.docs.map(serializeDoc).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0)) });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Impossible de charger les demandes.' }); }
});

router.patch('/api/admin/crypto-market/requests/:id', requireDb, requireAdminSecret, requireAdminPermission('settings'), async (req, res) => {
  try {
    const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 1000) : '';
    const transactionHash = typeof req.body?.transactionHash === 'string' ? req.body.transactionHash.trim().slice(0, 256) : '';
    if (!CRYPTO_MARKET_STATUSES.includes(nextStatus as any) || nextStatus === 'pending') return res.status(400).json({ error: 'Transition de statut invalide.' });
    const requestRef = adminDb.collection('crypto_market_requests').doc(req.params.id);
    const auditRef = adminDb.collection('crypto_market_audit').doc();
    const adminId = res.locals.adminSession?.adminId || '';
    let updated: any;

    await adminDb.runTransaction(async transaction => {
      const snap = await transaction.get(requestRef);
      if (!snap.exists) throw new Error('Demande introuvable.');
      const current = snap.data()!;
      const allowed: Record<string, string[]> = { pending: ['processing', 'rejected'], processing: ['sent', 'rejected'], sent: [], rejected: [] };
      if (!allowed[current.status]?.includes(nextStatus)) throw new Error('Cette transition de statut n’est pas autorisée.');
      if (nextStatus === 'sent' && !validateCryptoTransactionHash(transactionHash, String(current.offerSnapshot?.networkCode || ''))) {
        throw new Error('Le hash de transaction ne correspond pas au réseau de cette demande.');
      }
      const updates: any = {
        status: nextStatus, updatedAt: FieldValue.serverTimestamp(), processedBy: adminId,
        ...(adminNote ? { adminNote } : {}),
        ...(transactionHash ? { transactionHash } : {}),
        ...(nextStatus === 'processing' ? { processedAt: FieldValue.serverTimestamp() } : {}),
        ...(nextStatus === 'sent' ? { completedAt: FieldValue.serverTimestamp() } : {}),
        ...(nextStatus === 'rejected' ? { rejectedAt: FieldValue.serverTimestamp() } : {}),
      };
      transaction.update(requestRef, updates);
      if (nextStatus === 'sent' || nextStatus === 'rejected') {
        const dedupeId = current.dedupeId;
        if (dedupeId) transaction.update(adminDb.collection('crypto_market_request_dedupes').doc(dedupeId), { active: false, updatedAt: FieldValue.serverTimestamp() });
      }
      transaction.set(auditRef, {
        requestId: requestRef.id, clientId: current.clientId, actorType: 'admin', actorId: adminId,
        action: 'status_changed', fromStatus: current.status, toStatus: nextStatus,
        note: adminNote || null, transactionHash: transactionHash || null, createdAt: FieldValue.serverTimestamp(),
      });
      updated = { id: requestRef.id, ...current, ...updates };
    });

    const notification = cryptoRequestStatusMessage(nextStatus, updated.offerSnapshot?.symbol || 'crypto', adminNote);
    await adminDb.collection('client_notifications').add({
      clientId: updated.clientId, type: 'crypto_market', title: notification.title, message: notification.message,
      requestId: requestRef.id, read: false, createdAt: FieldValue.serverTimestamp(),
    });
    sendFcmToClient(updated.clientId, notification.title, notification.message, { type: 'crypto_market', requestId: requestRef.id, status: nextStatus });
    pushClientEvent(updated.clientId, 'crypto_market_updated', { id: requestRef.id, status: nextStatus });
    res.json({ request: updated });
  } catch (e: any) {
    const status = /introuvable|autorisée|requis/.test(String(e.message)) ? 400 : 500;
    res.status(status).json({ error: e.message || 'Mise à jour impossible.' });
  }
});

// ── Admin: Parcels ────────────────────────────────────────────────────────────
router.post('/api/admin/parcel', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('parcels').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('parcels').add({ ...data, createdAt: ts, updatedAt: ts });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/parcel/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('parcels').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Products ───────────────────────────────────────────────────────────
router.post('/api/admin/product', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('products').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('products').add({ ...data, createdAt: ts });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/product/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('products').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Games ──────────────────────────────────────────────────────────────
router.post('/api/admin/game', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('games').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('games').add({ ...data, createdAt: ts, updatedAt: ts });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/game/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('games').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Card Topups ────────────────────────────────────────────────────────
router.post('/api/admin/card-topup', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('card_topups').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('card_topups').add({ ...data, createdAt: ts, updatedAt: ts });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/card-topup/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('card_topups').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Nav Buttons ────────────────────────────────────────────────────────
router.post('/api/admin/nav-button', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('nav_buttons').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('nav_buttons').add({ ...data, createdAt: ts, updatedAt: ts });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/nav-button/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('nav_buttons').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Slider Images ──────────────────────────────────────────────────────
router.post('/api/admin/slider-image', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { url, title, description } = req.body;
    const ref = await adminDb.collection('slider_images').add({
      url, title: title || '', description: description || '',
      createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/api/admin/slider-image/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const updates: any = { updatedAt: FieldValue.serverTimestamp() };
    const { url, title, description } = req.body;
    if (url !== undefined) updates.url = url;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    await adminDb.collection('slider_images').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/slider-image/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('slider_images').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Shipping Configs ───────────────────────────────────────────────────
router.post('/api/admin/shipping-config', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id: _id, type, ...data } = req.body;
    if (!type) return res.status(400).json({ error: 'Type requis.' });
    await adminDb.collection('shipping_configs').doc(type).set(
      { ...data, type, updatedAt: FieldValue.serverTimestamp() }, { merge: true }
    );
    res.json({ success: true, id: type });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/shipping-config/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('shipping_configs').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Settings ───────────────────────────────────────────────────────────
router.post('/api/admin/settings', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const cleanData = Object.entries(req.body).reduce((acc: any, [k, v]) => {
      if (v !== undefined) acc[k] = v;
      return acc;
    }, {});
    await adminDb.collection('settings').doc('global').set(cleanData, { merge: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Admin: Admin Accounts CRUD ────────────────────────────────────────────────
router.post('/api/admin/account', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      const previous = await adminDb.collection('admin_accounts').doc(id).get();
      const oldUid = previous.data()?.uid;
      if (oldUid && (data.disabled === true || (data.uid && data.uid !== oldUid))) {
        await Promise.all([
          getAuth().revokeRefreshTokens(oldUid),
          getAuth().setCustomUserClaims(oldUid, {}),
        ]);
      }
      if (typeof data.password === 'string' && data.password) {
        data.passwordHash = hashPassword(data.password);
        delete data.password;
      }
      await adminDb.collection('admin_accounts').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    if (typeof data.password === 'string' && data.password) {
      data.passwordHash = hashPassword(data.password);
      delete data.password;
    }
    const ref = await adminDb.collection('admin_accounts').add({
      ...data, failedAttempts: 0, createdAt: ts, updatedAt: ts,
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/account/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const existing = await adminDb.collection('admin_accounts').doc(req.params.id).get();
    const uid = existing.data()?.uid;
    if (uid) {
      await Promise.all([
        getAuth().revokeRefreshTokens(uid),
        getAuth().setCustomUserClaims(uid, {}),
      ]);
    }
    await adminDb.collection('admin_accounts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Push Notifications ────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

let pushEnabled = false;
if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    let privKey = VAPID_PRIVATE_KEY.trim();
    // Normalize: remove whitespace/newlines, convert standard base64 to URL-safe base64, strip padding
    privKey = privKey.replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // If key decodes to 65 bytes (uncompressed EC point), extract the 32-byte private scalar
    try {
      const decoded = Buffer.from(privKey, 'base64');
      if (decoded.length === 65 || decoded.length === 33) {
        // This looks like a public key, not private — skip silently
        throw new Error('Key appears to be a public key, not private');
      }
      if (decoded.length !== 32) {
        // Re-encode exactly 32 bytes if possible
        const trimmed = decoded.slice(decoded.length - 32);
        privKey = trimmed.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
    } catch {}
    webpush.setVapidDetails('mailto:support@solutionpam.com', VAPID_PUBLIC_KEY, privKey);
    pushEnabled = true;
    console.log('[Push] VAPID configured');
  } catch (e) {
    console.warn('[Push] VAPID init failed:', e);
  }
} else {
  console.warn('[Push] Push notifications disabled (missing VAPID keys or web-push module)');
}

function subDocId(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

router.post('/api/push/subscribe', requireDb, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription invalide.' });
    const docId = subDocId(subscription.endpoint);
    await adminDb.collection('push_subscriptions').doc(docId).set({
      subscription,
      endpoint: subscription.endpoint,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[Push] subscribe error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/push/unsubscribe', requireDb, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) {
      await adminDb.collection('push_subscriptions').doc(subDocId(endpoint)).delete();
    }
    res.json({ success: true });
  } catch (e: any) {
    console.error('[Push] unsubscribe error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/push/send', requireDb, requireAdminSession, async (req, res) => {
  if (!pushEnabled)
    return res.status(503).json({ error: 'Push notifications non configurées.' });

  const { title, body, url, tag } = req.body;
  const payload = JSON.stringify({ title: title || 'Solutionpam', body: body || '', url: url || '/', tag: tag || 'solutionpam-notif', icon: '/solutionpam-icon.svg', badge: '/solutionpam-icon.svg' });

  const snap = await adminDb.collection('push_subscriptions').get();
  const subs = snap.docs.map(d => d.data().subscription);

  const results = await Promise.allSettled(
    subs.map(async (sub: any) => {
      try {
        await webpush!.sendNotification(sub, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await adminDb.collection('push_subscriptions').doc(subDocId(sub.endpoint)).delete();
        }
        throw err;
      }
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  res.json({ success: true, sent, failed, total: subs.length });
});

async function sendPushToAdmins(title: string, body: string, url = '/'): Promise<void> {
  if (!pushEnabled || !adminDb) return;
  try {
    const snap = await adminDb.collection('push_subscriptions').get();
    if (snap.empty) return;
    const payload = JSON.stringify({ title, body, url, icon: '/solutionpam-icon.svg', badge: '/solutionpam-icon.svg', tag: 'solutionpam-admin' });
    await Promise.allSettled(
      snap.docs.map(async (d) => {
        const sub = d.data().subscription;
        try {
          await webpush!.sendNotification(sub, payload);
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) await d.ref.delete();
        }
      })
    );
  } catch (e) {
    console.error('[Push] sendPushToAdmins error:', e);
  }
}

// ── Quiz: submit answers ───────────────────────────────────────────────────────
router.post('/api/formations/quiz/submit', requireDb, requireClientSession, async (req, res) => {
  try {
    const userId = res.locals.clientSession.clientId;
    const { formationId, chapterId, answers } = req.body;
    if (!formationId || !chapterId || !Array.isArray(answers))
      return res.status(400).json({ error: 'Données manquantes.' });

    const formationSnap = await adminDb.collection('formations').doc(formationId).get();
    if (!formationSnap.exists) return res.status(404).json({ error: 'Formation introuvable.' });
    const formation = formationSnap.data() as any;
    const chapter = (formation.chapters || []).find((c: any) => c.id === chapterId);
    if (!chapter?.quiz?.questions?.length) return res.status(400).json({ error: 'Aucun quiz pour ce chapitre.' });

    const questions = chapter.quiz.questions;
    const passPercent = chapter.quiz.passPercent ?? 80;
    let correct = 0;
    questions.forEach((q: any, i: number) => { if (answers[i] === q.correctIndex) correct++; });
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= passPercent;

    const existingSnap = await adminDb.collection('formation_quiz_results')
      .where('userId', '==', userId).where('formationId', '==', formationId).where('chapterId', '==', chapterId)
      .limit(1).get();

    const ts = FieldValue.serverTimestamp();
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      const prevAttempts = existing.data().attempts || 1;
      const prevPassed = existing.data().passed || false;
      await existing.ref.update({ score, passed: passed || prevPassed, attempts: prevAttempts + 1, completedAt: ts });
    } else {
      await adminDb.collection('formation_quiz_results').add({
        userId, formationId, chapterId, score, passed, attempts: 1, completedAt: ts,
      });
    }
    res.json({ success: true, score, passed, correct, total: questions.length, passPercent });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Quiz: get results for user + formation ────────────────────────────────────
router.get('/api/formations/quiz/results/:userId/:formationId', requireDb, requireClientSession, async (req, res) => {
  try {
    const { userId, formationId } = req.params;
    if (res.locals.clientSession.clientId !== userId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('formation_quiz_results')
      .where('userId', '==', userId).where('formationId', '==', formationId).get();
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: get for user + formation ────────────────────────────────────
router.get('/api/formations/certificate/:userId/:formationId', requireDb, requireClientSession, async (req, res) => {
  try {
    const { userId, formationId } = req.params;
    if (res.locals.clientSession.clientId !== userId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('formation_certificates')
      .where('userId', '==', userId).where('formationId', '==', formationId).limit(1).get();
    if (snap.empty) return res.json({ certificate: null });
    res.json({ certificate: { id: snap.docs[0].id, ...snap.docs[0].data() } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: list all (admin) ────────────────────────────────────────────
router.get('/api/admin/formations/certificates', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { formationId } = req.query;
    let query: any = adminDb.collection('formation_certificates').orderBy('issuedAt', 'desc');
    if (formationId) query = adminDb.collection('formation_certificates')
      .where('formationId', '==', formationId).orderBy('issuedAt', 'desc');
    const snap = await query.get();
    const certificates = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ certificates });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: issue (admin) ───────────────────────────────────────────────
router.post('/api/admin/formations/certificate', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { userId, userName, userEmail, formationId, formationTitle, issuedBy, pdfUrl } = req.body;
    if (!userId || !formationId) return res.status(400).json({ error: 'userId et formationId requis.' });
    const existing = await adminDb.collection('formation_certificates')
      .where('userId', '==', userId).where('formationId', '==', formationId).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Certificat déjà émis pour cet étudiant.' });
    const certificateCode = 'SPM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const certData: any = {
      userId, userName, userEmail: userEmail || '', formationId, formationTitle,
      issuedBy, certificateCode, issuedAt: FieldValue.serverTimestamp(),
    };
    if (pdfUrl) certData.pdfUrl = pdfUrl;
    const ref = await adminDb.collection('formation_certificates').add(certData);
    res.json({ success: true, id: ref.id, certificateCode });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: update pdfUrl (admin) ──────────────────────────────────────
router.patch('/api/admin/formations/certificate/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { pdfUrl } = req.body;
    await adminDb.collection('formation_certificates').doc(req.params.id).update({ pdfUrl: pdfUrl || '' });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: revoke (admin) ──────────────────────────────────────────────
router.delete('/api/admin/formations/certificate/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
    await adminDb.collection('formation_certificates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: list purchases for a formation (admin — for issuance UI) ────
router.get('/api/admin/formations/:formationId/students', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { formationId } = req.params;
    const snap = await adminDb.collection('formation_purchases')
      .where('formationId', '==', formationId).where('status', '==', 'active').get();
    const students = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ students });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── FCM Token Registration (multi-role) ──────────────────────────────────────
router.post('/api/fcm/register', requireDb, async (req, res) => {
  try {
    const { clientId, token, role, userId } = req.body;
    if (!token || typeof token !== 'string')
      return res.status(400).json({ error: 'token (string) requis.' });
    // Support legacy { clientId } and new { role, userId }
    const resolvedRole = role || 'client';
    const resolvedUserId = userId || clientId;
    if (!resolvedUserId || typeof resolvedUserId !== 'string')
      return res.status(400).json({ error: 'userId requis.' });
    const docId = resolvedRole === 'client' ? resolvedUserId : `${resolvedRole}_${resolvedUserId}`;
    await adminDb.collection('fcm_tokens').doc(docId).set({
      userId: resolvedUserId,
      role: resolvedRole,
      token,
      platform: 'web',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[FCM] register error:', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.delete('/api/fcm/unregister/:docId', requireDb, async (req, res) => {
  try {
    const { docId } = req.params;
    if (!docId) return res.status(400).json({ error: 'docId requis.' });
    await adminDb.collection('fcm_tokens').doc(docId).delete();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[FCM] unregister error:', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── TX Code: generate (client generates QR code for agent to scan) ─────────────
router.post('/api/client/generate-tx-code', requireDb, async (req, res) => {
  try {
    const { clientId, type, amount } = req.body;
    if (!clientId || !type || !['deposit', 'withdrawal'].includes(type))
      return res.status(400).json({ error: 'clientId et type (deposit|withdrawal) requis.' });
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const clientDoc = await adminDb.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientDoc.data()!;

    if (type === 'withdrawal' && (clientData.balance || 0) < usd)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60 * 60 * 1000; // 60 minutes

    const codeRef = await adminDb.collection('tx_codes').add({
      clientId,
      clientName: clientData.name || 'Client',
      type,
      amount: usd,
      token,
      expiresAt,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const codeData = JSON.stringify({ id: codeRef.id, tk: token, ty: type, a: usd, cn: clientData.name || 'Client' });
    res.json({ codeId: codeRef.id, codeData, expiresAt, clientName: clientData.name });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── TX Code: scan & process (affiliate scans client QR code) ──────────────────
router.post('/api/affiliate/scan-tx-code', requireDb, async (req, res) => {
  try {
    const { affiliateId, codeData } = req.body;
    if (!affiliateId || !codeData) return res.status(400).json({ error: 'affiliateId et codeData requis.' });

    let parsed: { id: string; tk: string };
    try { parsed = JSON.parse(codeData); } catch { return res.status(400).json({ error: 'Code QR invalide.' }); }
    const { id: codeId, tk: token } = parsed;
    if (!codeId || !token) return res.status(400).json({ error: 'Code QR malformé.' });

    const codeRef = adminDb.collection('tx_codes').doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) return res.status(404).json({ error: 'Code introuvable.' });
    const code = codeDoc.data()!;

    if (code.token !== token) return res.status(403).json({ error: 'Token invalide.' });
    if (code.used) return res.status(409).json({ error: 'Code déjà utilisé.' });
    if (Date.now() > code.expiresAt) return res.status(410).json({ error: 'Code expiré.' });

    const affRef = adminDb.collection('affiliates').doc(affiliateId);
    const affDoc = await affRef.get();
    if (!affDoc.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const aff = affDoc.data()!;

    const clientRef = adminDb.collection('clients').doc(code.clientId);
    const clientDoc = await clientRef.get();
    if (!clientDoc.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientSnap = clientDoc.data()!;

    const amount = parseFloat(code.amount);
    const type = code.type;

    if (type === 'deposit' && (aff.balance || 0) < amount)
      return res.status(400).json({ error: `Solde affilié insuffisant ($${(aff.balance || 0).toFixed(2)} disponible).` });
    if (type === 'withdrawal' && (clientSnap.balance || 0) < amount)
      return res.status(400).json({ error: `Solde client insuffisant ($${(clientSnap.balance || 0).toFixed(2)} disponible).` });

    // Load fee settings
    const feeSettingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings = feeSettingsSnap.exists ? feeSettingsSnap.data()! : {};

    // Compute fees for this operation
    let feeAmount = 0, affiliateShare = 0, adminShare = 0, netToClient = amount;
    if (type === 'deposit') {
      const feePercent = Number(feeSettings.depositFeePercent || 0);
      const affSharePct = Number(feeSettings.affiliateDepositFeeSharePercent || 0);
      feeAmount = feePercent > 0 ? parseFloat((amount * feePercent / 100).toFixed(4)) : 0;
      affiliateShare = feeAmount > 0 ? parseFloat((feeAmount * affSharePct / 100).toFixed(4)) : 0;
      adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));
      netToClient = parseFloat((amount - feeAmount).toFixed(4));
    } else {
      const feePercent = Number(feeSettings.withdrawalFeePercent || 0);
      const affSharePct = Number(feeSettings.affiliateWithdrawalFeeSharePercent || 0);
      feeAmount = feePercent > 0 ? parseFloat((amount * feePercent / 100).toFixed(4)) : 0;
      affiliateShare = feeAmount > 0 ? parseFloat((feeAmount * affSharePct / 100).toFixed(4)) : 0;
      adminShare = parseFloat((feeAmount - affiliateShare).toFixed(4));
      netToClient = parseFloat((amount - feeAmount).toFixed(4));
    }

    await adminDb.runTransaction(async (tx: any) => {
      const freshCode = (await tx.get(codeRef)).data();
      if (freshCode.used) throw new Error('Code déjà utilisé.');
      const now = FieldValue.serverTimestamp();
      const txRef = adminDb.collection('client_transactions').doc();
      tx.set(txRef, {
        clientId: code.clientId, clientName: code.clientName,
        affiliateId, affiliateName: aff.name || 'Agent',
        type, amount,
        method: 'Agent QR Code',
        status: 'completed',
        description: `${type === 'deposit' ? 'Dépôt' : 'Retrait'} via QR Code — Agent: ${aff.name || affiliateId}`,
        ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare, adminFeeShare: adminShare }),
        createdAt: now, processedAt: now,
      });
      tx.update(codeRef, { used: true, usedAt: now, usedBy: affiliateId });
      if (type === 'deposit') {
        // Affiliate spends (amount - affiliateShare) from their float; client receives net amount
        tx.update(affRef, { balance: FieldValue.increment(-(amount - affiliateShare)) });
        tx.update(clientRef, { balance: FieldValue.increment(netToClient) });
        if (adminShare > 0) {
          tx.update(adminDb.collection('settings').doc('global'), {
            feesBalance: FieldValue.increment(adminShare),
          });
        }
      } else {
        // Client debited full amount; affiliate receives net cash they hand out + their fee share
        tx.update(clientRef, { balance: FieldValue.increment(-amount) });
        tx.update(affRef, { balance: FieldValue.increment(amount - adminShare) });
        if (adminShare > 0) {
          tx.update(adminDb.collection('settings').doc('global'), {
            feesBalance: FieldValue.increment(adminShare),
          });
        }
      }
    });

    res.json({
      success: true, type, amount, netToClient, fee: feeAmount,
      clientName: code.clientName,
      message: `${type === 'deposit' ? 'Dépôt' : 'Retrait'} de $${amount.toFixed(2)} traité pour ${code.clientName}${feeAmount > 0 ? ` (frais: $${feeAmount.toFixed(2)}, client reçoit $${netToClient.toFixed(2)})` : ''}`,
    });
  } catch (e: any) {
    if (e.message === 'Code déjà utilisé.') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});


// ── Agent: scan client QR tx-code ─────────────────────────────────────────────
router.post('/api/agent/scan-tx-code', requireDb, async (req, res) => {
  try {
    const { agentCode, codeData } = req.body;
    if (!agentCode || !codeData) return res.status(400).json({ error: 'agentCode et codeData requis.' });

    let parsed: { id: string; tk: string; ty: string; a: number; cn: string };
    try { parsed = JSON.parse(codeData); } catch { return res.status(400).json({ error: 'Code QR invalide — format non reconnu.' }); }
    const { id: codeId, tk: token } = parsed;
    if (!codeId || !token) return res.status(400).json({ error: 'Code QR malformé.' });

    // Verify agent
    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(403).json({ error: 'Code agent invalide.' });
    const agentRef = agentSnap.docs[0].ref;
    const agentId  = agentSnap.docs[0].id;
    const agentData = agentSnap.docs[0].data();
    if (agentData.status === 'inactive') return res.status(403).json({ error: 'Agent inactif.' });

    // Verify QR code document
    const codeRef = adminDb.collection('tx_codes').doc(codeId);
    const codeDoc = await codeRef.get();
    if (!codeDoc.exists) return res.status(404).json({ error: 'Code introuvable ou déjà supprimé.' });
    const code = codeDoc.data()!;

    if (code.token !== token)       return res.status(403).json({ error: 'Code QR invalide.' });
    if (code.used)                  return res.status(409).json({ error: 'Ce code a déjà été utilisé.' });
    if (Date.now() > code.expiresAt) return res.status(410).json({ error: 'Ce code QR a expiré (validité 60 min).' });

    const usd    = parseFloat(code.amount);
    const txType = code.type as 'deposit' | 'withdrawal';

    // Get client
    const clientRef  = adminDb.collection('clients').doc(code.clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;

    // Load fee settings
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings  = settingsSnap.data() || {};
    const agentDepositCommissionPct   = Number(feeSettings.agentDepositCommissionPercent   || 0);
    const agentWithdrawPct            = Number(feeSettings.agentWithdrawPercent            || 0);
    const agentWithdrawAgentSharePct  = Number(feeSettings.agentWithdrawAgentSharePercent  ?? 100);
    const agentDepositFeeMode  = feeSettings.agentDepositFeeMode  || 'percent';
    const agentWithdrawFeeMode = feeSettings.agentWithdrawFeeMode || 'percent';

    // Fee calculation (same logic as /api/agent/client-transaction)
    let commissionAmount = 0;
    let totalFee = 0, agentShareFee = 0, adminShareFee = 0;
    if (txType === 'deposit') {
      commissionAmount = agentDepositFeeMode === 'fixed'
        ? parseFloat(Number(feeSettings.agentDepositCommissionFixed || 0).toFixed(4))
        : parseFloat((usd * agentDepositCommissionPct / 100).toFixed(4));
    } else {
      totalFee = agentWithdrawFeeMode === 'fixed'
        ? parseFloat(Number(feeSettings.agentWithdrawFixed || 0).toFixed(4))
        : parseFloat((usd * agentWithdrawPct / 100).toFixed(4));
      agentShareFee = parseFloat((totalFee * agentWithdrawAgentSharePct / 100).toFixed(4));
      adminShareFee = parseFloat((totalFee - agentShareFee).toFixed(4));
    }

    // Balance checks
    if (txType === 'deposit' && (agentData.balance || 0) < usd)
      return res.status(400).json({ error: `Solde agent insuffisant (${(agentData.balance || 0).toFixed(2)} disponible).` });
    if (txType === 'withdrawal' && (clientData.balance || 0) < usd)
      return res.status(400).json({ error: `Solde client insuffisant (${(clientData.balance || 0).toFixed(2)} disponible).` });

    const label = txType === 'deposit' ? 'Dépôt' : 'Retrait';

    await adminDb.runTransaction(async (txn: any) => {
      const freshCode = (await txn.get(codeRef)).data();
      if (freshCode!.used) throw new Error('Code déjà utilisé.');
      const now = FieldValue.serverTimestamp();

      if (txType === 'deposit') {
        txn.update(clientRef, { balance: FieldValue.increment(usd), updatedAt: now });
        txn.update(agentRef, {
          balance: FieldValue.increment(-usd),
          commissionBalance: FieldValue.increment(commissionAmount),
          monthlyTransactions: FieldValue.increment(1),
          updatedAt: now,
        });
      } else {
        txn.update(clientRef, { balance: FieldValue.increment(-usd), updatedAt: now });
        txn.update(agentRef, {
          balance: FieldValue.increment(usd - totalFee),
          commissionBalance: FieldValue.increment(agentShareFee),
          monthlyTransactions: FieldValue.increment(1),
          updatedAt: now,
        });
        if (adminShareFee > 0) {
          txn.update(adminDb.collection('settings').doc('global'), { feesBalance: FieldValue.increment(adminShareFee) });
        }
      }

      txn.update(codeRef, { used: true, usedAt: now, usedBy: agentId, usedByCode: agentCode });

      const txRef = adminDb.collection('client_transactions').doc();
      txn.set(txRef, {
        clientId: code.clientId,
        clientName: code.clientName || clientData.name || '',
        type: txType, amount: usd, status: 'approved',
        method: `Agent QR Code: ${agentData.name}`,
        agentCode, agentName: agentData.name || '', agentId,
        description: `${label} via Code QR — Agent: ${agentData.name}`,
        ...(txType === 'deposit'    && commissionAmount > 0 && { agentCommission: commissionAmount }),
        ...(txType === 'withdrawal' && totalFee > 0         && { fee: totalFee, agentFeeShare: agentShareFee, adminFeeShare: adminShareFee }),
        createdAt: now, updatedAt: now,
      });

      if (commissionAmount > 0 || totalFee > 0) {
        txn.set(adminDb.collection('agent_fee_records').doc(), {
          agentId, agentCode, agentName: agentData.name || '',
          clientId: code.clientId, clientName: code.clientName || clientData.name || '',
          operationType: txType, baseAmount: usd,
          feeTotal: txType === 'deposit' ? commissionAmount : totalFee,
          agentShare: txType === 'deposit' ? commissionAmount : agentShareFee,
          adminShare: txType === 'deposit' ? 0 : adminShareFee,
          createdAt: now,
        });
      }

      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: `agent_client_${txType}_qr`,
        clientId: code.clientId, clientName: code.clientName || clientData.name || '',
        agentCode, agentName: agentData.name || '', amount: usd,
        ...(txType === 'deposit'    && commissionAmount > 0 && { agentCommission: commissionAmount }),
        ...(txType === 'withdrawal' && totalFee > 0         && { fee: totalFee, agentFeeShare: agentShareFee }),
        read: false, createdAt: now,
      });
    });

    res.json({
      success: true, type: txType, amount: usd,
      clientName: code.clientName || clientData.name || '',
      ...(txType === 'deposit'    && commissionAmount > 0 && { agentCommission: commissionAmount }),
      ...(txType === 'withdrawal' && totalFee > 0         && { fee: totalFee }),
      message: `${label} de ${usd.toFixed(2)} traité avec succès pour ${code.clientName || clientData.name}`,
    });
  } catch (e: any) {
    if (e.message === 'Code déjà utilisé.') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// ── Teachers ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/api/teacher/login', requireDb, async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Identifiants requis.' });
    const snap = await adminDb.collection('teachers').where('name', '==', name).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Identifiants incorrects.' });
    const doc = snap.docs[0];
    const data = doc.data();
    if (data.status === 'inactive') return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
    if (data.password !== password) return res.status(401).json({ error: 'Identifiants incorrects.' });
    setTeacherSession(res, doc.id);
    res.json({ success: true, teacher: { id: doc.id, ...data, password: undefined } });
  } catch (e: any) {
    console.error('[teacher/login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

router.post('/api/teacher/logout', (_req, res) => {
  res.clearCookie('rena_teacher_session', { path: '/' });
  res.json({ success: true });
});

router.post('/api/teacher/verify-google', requireDb, async (req, res) => {
  try {
    const { email, uid, googleName, googlePhotoUrl } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis.' });
    const snap = await adminDb.collection('teachers').where('email', '==', email).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'Aucun compte professeur associé à cet email Google. Contactez l\'administrateur.' });
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (data.status === 'inactive') return res.status(403).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
    const updates: any = { updatedAt: FieldValue.serverTimestamp() };
    if (uid) updates.uid = uid;
    if (googlePhotoUrl) updates.photoUrl = googlePhotoUrl; // always sync Google photo
    await docSnap.ref.update(updates);
    setTeacherSession(res, docSnap.id);
    res.json({ success: true, teacher: { id: docSnap.id, ...data, ...updates, password: undefined } });
  } catch (e: any) {
    console.error('[teacher/verify-google]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion Google.' });
  }
});

router.get('/api/teacher/me/:id', requireDb, requireTeacherSession, async (req, res) => {
  try {
    if (res.locals.teacherSession.teacherId !== req.params.id) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('teachers').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Professeur introuvable.' });
    const data = snap.data()!;
    res.json({ teacher: { id: snap.id, ...data, password: undefined } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/teacher/formations/:teacherId', requireDb, requireTeacherSession, async (req, res) => {
  try {
    if (res.locals.teacherSession.teacherId !== req.params.teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('formations').where('teacherId', '==', req.params.teacherId).get();
    res.json({ formations: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/teacher/formations', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const teacherId = res.locals.teacherSession.teacherId;
    const { teacherName, ...rest } = req.body;
    const data = sanitizeFormation(rest);
    delete data.teacherId;
    if (!data.title) return res.status(400).json({ error: 'Le titre est requis.' });
    const ref = await adminDb.collection('formations').add({
      ...data,
      teacherId,
      teacherName: teacherName || res.locals.teacherRecord.data()?.name || '',
      studentsCount: data.studentsCount ?? 0,
      rating: data.rating ?? 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) {
    console.error('[teacher/formations POST]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la création.' });
  }
});

router.put('/api/teacher/formations/:id', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const teacherId = res.locals.teacherSession.teacherId;
    const { teacherId: _ignored, ...rest } = req.body;
    const formSnap = await adminDb.collection('formations').doc(req.params.id).get();
    if (!formSnap.exists) return res.status(404).json({ error: 'Formation introuvable.' });
    if (formSnap.data()!.teacherId !== teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const data = sanitizeFormation(rest);
    delete data.teacherId;
    await adminDb.collection('formations').doc(req.params.id).update({
      ...data, updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[teacher/formations PUT]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la mise à jour.' });
  }
});

router.delete('/api/teacher/formations/:id', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const teacherId = res.locals.teacherSession.teacherId;
    const formSnap = await adminDb.collection('formations').doc(req.params.id).get();
    if (!formSnap.exists) return res.status(404).json({ error: 'Formation introuvable.' });
    if (formSnap.data()!.teacherId !== teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    await adminDb.collection('formations').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    console.error('[teacher/formations DELETE]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la suppression.' });
  }
});

router.post('/api/teacher/withdrawal', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const teacherId = res.locals.teacherSession.teacherId;
    const { amount, method, accountNumber } = req.body;
    if (!amount || !method || !accountNumber)
      return res.status(400).json({ error: 'Paramètres manquants.' });

    const teacherRef = adminDb.collection('teachers').doc(teacherId);
    const teacherSnap = await teacherRef.get();
    if (!teacherSnap.exists) return res.status(404).json({ error: 'Professeur introuvable.' });
    const teacherData = teacherSnap.data()!;

    // Load teacher fee from settings
    const settingsSnap = await adminDb.collection('settings').doc('main').get();
    const teacherWithdrawalFee = settingsSnap.exists ? (settingsSnap.data()!.teacherWithdrawalFee ?? 0) : 0;

    const amountUSD = Number(amount);
    const exchangeRate = settingsSnap.exists ? (settingsSnap.data()!.exchangeRate ?? 146) : 146;
    const amountHTG = Math.round(amountUSD * exchangeRate);
    const feeAmount = Math.round(amountHTG * teacherWithdrawalFee / 100);
    const netAmountHTG = amountHTG - feeAmount;

    if ((teacherData.balance || 0) < amountUSD)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    // Check no pending withdrawal
    const pendingSnap = await adminDb.collection('teacher_transactions')
      .where('teacherId', '==', teacherId).where('status', '==', 'pending').limit(1).get();
    if (!pendingSnap.empty) return res.status(400).json({ error: 'Vous avez déjà un retrait en attente.' });

    const twBatch = adminDb.batch();
    const twTxRef = adminDb.collection('teacher_transactions').doc();
    twBatch.set(twTxRef, {
      teacherId,
      teacherName: teacherData.name || '',
      type: 'withdrawal',
      amount: amountUSD,
      fee: teacherWithdrawalFee,
      netAmount: netAmountHTG / exchangeRate,
      amountHTG,
      netAmountHTG,
      feeAmount,
      method,
      accountNumber,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Deduct balance immediately on submission
    twBatch.update(teacherRef, {
      balance: FieldValue.increment(-amountUSD),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Notify admin
    twBatch.set(adminDb.collection('admin_notifications').doc(), {
      type: 'teacher_withdrawal',
      teacherId,
      teacherName: teacherData.name || '',
      amount: amountUSD,
      amountHTG,
      netAmountHTG,
      fee: teacherWithdrawalFee,
      method,
      accountNumber,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await twBatch.commit();

    res.json({ success: true });
  } catch (e: any) {
    console.error('[teacher/withdrawal]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.get('/api/teacher/transactions/:teacherId', requireDb, requireTeacherSession, async (req, res) => {
  try {
    if (res.locals.teacherSession.teacherId !== req.params.teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('teacher_transactions')
      .where('teacherId', '==', req.params.teacherId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Teacher Management ─────────────────────────────────────────────────

router.get('/api/admin/teachers', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('teachers').orderBy('createdAt', 'desc').get();
    res.json({ teachers: snap.docs.map(d => ({ id: d.id, ...d.data(), password: undefined })) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/admin/teachers', requireDb, async (req, res) => {
  try {
    const { name, email, password, status } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Nom et mot de passe requis.' });
    const existing = await adminDb.collection('teachers').where('name', '==', name).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: 'Un professeur avec ce nom existe déjà.' });
    const ref = await adminDb.collection('teachers').add({
      name, email: email || '', password, balance: 0,
      status: status || 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/admin/teachers/:id', requireDb, async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const upd: any = { ...rest, updatedAt: FieldValue.serverTimestamp() };
    if (password) upd.password = password;
    await adminDb.collection('teachers').doc(req.params.id).update(upd);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/admin/teachers/:id', requireDb, async (req, res) => {
  try {
    await adminDb.collection('teachers').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/admin/teacher-transactions', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('teacher_transactions').orderBy('createdAt', 'desc').get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/admin/teacher-transactions/:id/approve', requireDb, async (req, res) => {
  try {
    const txRef = adminDb.collection('teacher_transactions').doc(req.params.id);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const tx = txSnap.data()!;
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });

    const teacherRef = adminDb.collection('teachers').doc(tx.teacherId);
    const teacherSnap = await teacherRef.get();
    if (!teacherSnap.exists) return res.status(404).json({ error: 'Professeur introuvable.' });
    const teacherData = teacherSnap.data()!;

    // Balance already deducted on submission — just mark approved
    await transitionPending(txRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/admin/teacher-transactions/:id/reject', requireDb, async (req, res) => {
  try {
    const { reason } = req.body;
    const txRef = adminDb.collection('teacher_transactions').doc(req.params.id);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const txData = txSnap.data()!;
    if (txData.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });
    // Refund teacher balance (was deducted on submission)
    const teacherRefReject = adminDb.collection('teachers').doc(txData.teacherId);
    await adminDb.runTransaction(async (t) => {
      const latestTx = await t.get(txRef);
      if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Transaction déjà traitée.');
      if (latestTx.data()!.teacherId !== txData.teacherId) throw new Error('Accès refusé.');
      t.update(txRef, { status: 'rejected', rejectionReason: reason || '', updatedAt: FieldValue.serverTimestamp() });
      t.update(teacherRefReject, { balance: FieldValue.increment(txData.amount || 0), updatedAt: FieldValue.serverTimestamp() });
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/admin/teacher-fee', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('main').get();
    const fee = snap.exists ? (snap.data()!.teacherWithdrawalFee ?? 0) : 0;
    res.json({ fee });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/admin/teacher-fee', requireDb, async (req, res) => {
  try {
    const { fee } = req.body;
    if (fee === undefined || fee < 0 || fee > 100) return res.status(400).json({ error: 'Frais invalides (0-100%).' });
    await adminDb.collection('settings').doc('main').set(
      { teacherWithdrawalFee: Number(fee), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Teacher withdrawals (alias routes expected by AdminDashboard) ─────────────
router.get('/api/admin/teacher-withdrawals', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('teacher_transactions')
      .where('type', '==', 'withdrawal')
      .orderBy('createdAt', 'desc')
      .get();
    res.json({ withdrawals: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/admin/teacher-withdrawals/:id', requireDb, async (req, res) => {
  const { action, reason } = req.body as { action: 'approve' | 'reject'; reason?: string };
  if (action !== 'approve' && action !== 'reject')
    return res.status(400).json({ error: 'action doit être "approve" ou "reject".' });

  try {
    const txRef = adminDb.collection('teacher_transactions').doc(req.params.id);
    const txSnap = await txRef.get();
    if (!txSnap.exists) return res.status(404).json({ error: 'Transaction introuvable.' });
    const tx = txSnap.data()!;
    if (tx.status !== 'pending') return res.status(400).json({ error: 'Transaction déjà traitée.' });

    if (action === 'approve') {
      const teacherRef = adminDb.collection('teachers').doc(tx.teacherId);
      const feeAmount = parseFloat(((tx.amount || 0) - (tx.netAmount || 0)).toFixed(4));
      await adminDb.runTransaction(async (txn) => {
        const [latestTx, teacherSnap] = await Promise.all([txn.get(txRef), txn.get(teacherRef)]);
        if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Transaction déjà traitée.');
        if (latestTx.data()!.teacherId !== tx.teacherId) throw new Error('Accès refusé.');
        if (!teacherSnap.exists) throw new Error('Professeur introuvable.');
        const teacherBalance = Number(teacherSnap.data()!.balance || 0);
        const amount = Number(latestTx.data()!.amount || 0);
        if (teacherBalance < amount) throw new Error('Solde professeur insuffisant.');
        txn.update(txRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });
        txn.update(teacherRef, { balance: FieldValue.increment(-amount), updatedAt: FieldValue.serverTimestamp() });
        if (feeAmount > 0) txn.update(adminDb.collection('settings').doc('global'), {
          feesBalance: FieldValue.increment(feeAmount),
          teacherWithdrawalFeesTotal: FieldValue.increment(feeAmount),
        });
      });
    } else {
      await transitionPending(txRef, {
        status: 'rejected',
        rejectionReason: reason || '',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Profit stats (combined fees from all sources) ──────────────────────
router.get('/api/admin/profit-stats', requireDb, async (_req, res) => {
  try {
    const [globalSnap, teacherTxSnap] = await Promise.all([
      adminDb.collection('settings').doc('global').get(),
      adminDb.collection('teacher_transactions').where('type', 'in', ['sale_credit', 'withdrawal']).get(),
    ]);

    const globalData = globalSnap.exists ? globalSnap.data()! : {};
    const feesBalance = globalData.feesBalance || 0;
    const lastReset = globalData.lastProfitReset || null;

    // Formation platform fees (sum of platformFee from sale_credit)
    let formationFees = 0;
    let teacherWithdrawalFees = 0;
    for (const doc of teacherTxSnap.docs) {
      const d = doc.data();
      if (d.type === 'sale_credit' && d.platformFee) formationFees += Number(d.platformFee) || 0;
      if (d.type === 'withdrawal' && d.status === 'approved') {
        const fee = parseFloat(((d.amount || 0) - (d.netAmount || d.amount || 0)).toFixed(4));
        if (fee > 0) teacherWithdrawalFees += fee;
      }
    }

    // Use tracked totals from global settings when available (incremented on each approval)
    const affiliateWithdrawalFees = globalData.affiliateWithdrawalFeesTotal || 0;
    const teacherWdFeesTotal = globalData.teacherWithdrawalFeesTotal || teacherWithdrawalFees;
    // feesBalance is the authoritative total; avoid double-counting formation fees that are tracked separately
    const clientFees = Math.max(0, feesBalance - affiliateWithdrawalFees - teacherWdFeesTotal);

    res.json({
      feesBalance,
      formationFees: parseFloat(formationFees.toFixed(4)),
      lastReset,
      breakdown: {
        clientDepositFees: parseFloat((clientFees * 0.6).toFixed(4)),
        clientWithdrawalFees: parseFloat((clientFees * 0.4).toFixed(4)),
        formationPlatformFees: parseFloat(formationFees.toFixed(4)),
        teacherWithdrawalFees: parseFloat(teacherWdFeesTotal.toFixed(4)),
        affiliateWithdrawalFees: parseFloat(affiliateWithdrawalFees.toFixed(4)),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Reset accumulated profit balance ───────────────────────────────────
router.post('/api/admin/profit/reset', requireDb, async (req, res) => {
  try {
    const settingsRef = adminDb.collection('settings').doc('global');
    let previousBalance = 0;
    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(settingsRef);
      const current = snap.exists ? Number(snap.data()!.feesBalance || 0) : 0;
      if (current <= 0) throw new Error('Aucun profit à réinitialiser.');
      previousBalance = current;
      txn.set(settingsRef, {
        feesBalance: 0,
        lastProfitReset: FieldValue.serverTimestamp(),
        teacherWithdrawalFeesTotal: 0,
        affiliateWithdrawalFeesTotal: 0,
      }, { merge: true });
      txn.set(adminDb.collection('admin_notifications').doc(), {
        type: 'profit_reset',
        previousBalance: current,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ success: true, previousBalance });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Formation purchase fee (platform commission on formation sales) ────────────
router.get('/api/admin/formation-fee', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('main').get();
    const fee = snap.exists ? (snap.data()!.formationPurchaseFee ?? 0) : 0;
    res.json({ fee });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/admin/formation-fee', requireDb, async (req, res) => {
  try {
    const { fee } = req.body;
    const n = Number(fee);
    if (fee === undefined || isNaN(n) || n < 0 || n > 100)
      return res.status(400).json({ error: 'Frais invalides (0-100%).' });
    await adminDb.collection('settings').doc('main').set(
      { formationPurchaseFee: n, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Notifications: affiliate ──────────────────────────────────────────────────
router.get('/api/affiliate/notifications/:affiliateId', requireDb, async (req, res) => {
  try {
    const { affiliateId } = req.params;
    if (!affiliateId) return res.status(400).json({ error: 'affiliateId requis.' });
    const snap = await adminDb.collection('affiliate_notifications')
      .where('affiliateId', '==', affiliateId)
      .orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/affiliate/notifications/:id/read', requireDb, async (req, res) => {
  try {
    await adminDb.collection('affiliate_notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/affiliate/notifications/read-all/:affiliateId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('affiliate_notifications')
      .where('affiliateId', '==', req.params.affiliateId).where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/affiliate/notifications/clear-all/:affiliateId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('affiliate_notifications')
      .where('affiliateId', '==', req.params.affiliateId).limit(200).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Notifications: agent ──────────────────────────────────────────────────────
router.get('/api/agent/notifications/:agentId', requireDb, async (req, res) => {
  try {
    const { agentId } = req.params;
    if (!agentId) return res.status(400).json({ error: 'agentId requis.' });
    const snap = await adminDb.collection('agent_notifications')
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/agent/notifications/:id/read', requireDb, async (req, res) => {
  try {
    await adminDb.collection('agent_notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/agent/notifications/read-all/:agentId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('agent_notifications')
      .where('agentId', '==', req.params.agentId).where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/agent/notifications/clear-all/:agentId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('agent_notifications')
      .where('agentId', '==', req.params.agentId).limit(200).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Notifications: teacher ────────────────────────────────────────────────────
router.get('/api/teacher/notifications/:teacherId', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (res.locals.teacherSession.teacherId !== teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('teacher_notifications')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/teacher/notifications/:id/read', requireDb, requireTeacherSession, async (req, res) => {
  try {
    const ref = adminDb.collection('teacher_notifications').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Notification introuvable.' });
    if (snap.data()!.teacherId !== res.locals.teacherSession.teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    await ref.update({ read: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/teacher/notifications/read-all/:teacherId', requireDb, requireTeacherSession, async (req, res) => {
  try {
    if (res.locals.teacherSession.teacherId !== req.params.teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('teacher_notifications')
      .where('teacherId', '==', req.params.teacherId).where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/teacher/notifications/clear-all/:teacherId', requireDb, requireTeacherSession, async (req, res) => {
  try {
    if (res.locals.teacherSession.teacherId !== req.params.teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const snap = await adminDb.collection('teacher_notifications')
      .where('teacherId', '==', req.params.teacherId).limit(200).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Notifications: admin SSE (push new_notification to all connected admins) ──
router.get('/api/admin/notifications-sse-count', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('admin_notifications').where('read', '==', false).get();
    res.json({ count: snap.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── AI Multi-agent code analyzer ─────────────────────────────────────────────

// Scopes: each maps to a list of project file paths (relative to cwd)
const AI_SCOPES: Record<string, { label: string; files: string[] }> = {
  api: {
    label: 'Routes API',
    files: ['src/api/router.ts'],
  },
  client: {
    label: 'Dashboard Client',
    files: ['src/pages/ClientDashboard.tsx', 'src/services/clientService.ts'],
  },
  admin: {
    label: 'Dashboard Admin',
    files: ['src/pages/AdminDashboard.tsx'],
  },
  services: {
    label: 'Services & Auth',
    files: ['src/hooks/useAuth.ts', 'src/lib/firebase.ts', 'src/services/clientService.ts'],
  },
  config: {
    label: 'Config & Sécurité',
    files: ['server.ts', 'firestore.rules', 'src/api/router.ts'],
  },
  all: {
    label: 'Vue globale',
    files: [
      'server.ts',
      'src/api/router.ts',
      'src/hooks/useAuth.ts',
      'src/lib/firebase.ts',
      'src/services/clientService.ts',
      'src/pages/ClientDashboard.tsx',
      'src/pages/AdminDashboard.tsx',
    ],
  },
};

// Maximum chars per file excerpt sent to agents
const MAX_FILE_CHARS = 6_000;
// Maximum total chars of combined code (stays comfortably within Groq context)
const MAX_TOTAL_CHARS = 14_000;

router.get('/api/admin/analyze/scopes', (_req, res) => {
  res.json(Object.entries(AI_SCOPES).map(([id, s]) => ({ id, label: s.label, files: s.files })));
});

// ── AI config: read/write per-agent Groq keys in Firestore ────────────────────
router.get('/api/admin/ai-config', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('ai_config').get();
    const data = snap.exists ? snap.data()! : {};
    // Never send the actual key values — just whether they're set
    res.json({
      security:    data.security    ? '••••••••' : '',
      ui:          data.ui          ? '••••••••' : '',
      performance: data.performance ? '••••••••' : '',
      admin:       data.admin       ? '••••••••' : '',
      hasKeys: {
        security:    !!data.security,
        ui:          !!data.ui,
        performance: !!data.performance,
        admin:       !!data.admin,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/admin/ai-config', requireDb, async (req, res) => {
  try {
    const { security, ui, performance, admin } = req.body as Record<string, string>;
    const update: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof security    === 'string' && security.trim())    update.security    = security.trim();
    if (typeof ui          === 'string' && ui.trim())          update.ui          = ui.trim();
    if (typeof performance === 'string' && performance.trim()) update.performance = performance.trim();
    if (typeof admin       === 'string' && admin.trim())       update.admin       = admin.trim();
    await adminDb.collection('settings').doc('ai_config').set(update, { merge: true });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/ai-config/:agent', requireDb, async (req, res) => {
  try {
    const agent = req.params.agent;
    if (!['security','ui','performance','admin'].includes(agent))
      return res.status(400).json({ error: 'Agent inconnu.' });
    await adminDb.collection('settings').doc('ai_config').set(
      { [agent]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/admin/analyze', async (req, res) => {
  try {
    const { scope, code: rawCode } = req.body as { scope?: string; code?: string };

    // Load per-agent keys from Firestore (fallback to env var GROQ_API_KEY)
    let agentKeys: Record<string, string | undefined> = {};
    try {
      if (adminDb) {
        const cfgSnap = await adminDb.collection('settings').doc('ai_config').get();
        if (cfgSnap.exists) agentKeys = cfgSnap.data() as Record<string, string>;
      }
    } catch {}

    // Ensure at least one key is available
    const hasAnyKey = agentKeys.security || agentKeys.ui || agentKeys.performance || agentKeys.admin || process.env.GROQ_API_KEY;
    if (!hasAnyKey)
      return res.status(503).json({ error: 'Aucune clé GROQ_API_KEY configurée. Ajoutez-en une dans Analyse IA → Configuration.' });

    let code = '';

    if (scope && AI_SCOPES[scope]) {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const cwd = process.cwd();
      const parts: string[] = [];
      for (const filePath of AI_SCOPES[scope].files) {
        try {
          const content = await readFile(join(cwd, filePath), 'utf-8');
          const excerpt = content.length > MAX_FILE_CHARS
            ? content.slice(0, MAX_FILE_CHARS) + `\n\n// [... ${filePath} tronqué — ${content.length.toLocaleString()} chars ...]`
            : content;
          parts.push(`// ═══ FICHIER : ${filePath} ═══\n${excerpt}`);
        } catch {
          parts.push(`// ═══ FICHIER : ${filePath} — non trouvé ═══`);
        }
      }
      code = parts.join('\n\n');
      if (code.length > MAX_TOTAL_CHARS)
        code = code.slice(0, MAX_TOTAL_CHARS) + '\n\n// [... combinaison tronquée ...]';
    } else if (rawCode && rawCode.trim().length >= 50) {
      code = rawCode;
    } else {
      return res.status(400).json({ error: 'Fournissez un `scope` valide ou un champ `code` (min 50 caractères).' });
    }

    const { orchestrate } = await import('./ai/orchestrator.ts');
    const report = await orchestrate(code, {
      security:    agentKeys.security    || undefined,
      ui:          agentKeys.ui          || undefined,
      performance: agentKeys.performance || undefined,
      admin:       agentKeys.admin       || undefined,
    });
    res.json(report);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur interne du système IA.' });
  }
});

// ── AI Chat libre ─────────────────────────────────────────────────────────────
const AI_CHAT_SYSTEM = `Tu es un développeur senior qui travaille EXCLUSIVEMENT sur le projet "Solutionpam".

## Architecture Solutionpam (mémorise-la)
- **Frontend** : React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui
  - \`src/pages/AdminDashboard.tsx\` — tableau de bord admin (12 000+ lignes, très grand fichier)
  - \`src/pages/ClientDashboard.tsx\` — tableau de bord client
  - \`src/hooks/useAuth.ts\` — détection du rôle Firebase Auth
  - \`src/lib/firebase.ts\` — init Firebase client SDK
- **Backend** : Express 4 + Firebase Admin SDK 13
  - \`src/api/router.ts\` — SOURCE UNIQUE de toutes les routes (50+ routes API). Ne jamais dupliquer dans server.ts
  - \`server.ts\` — point d'entrée HTTP, importe router.ts + middleware Vite dev
- **Base de données** : Cloud Firestore, DB nommée \`ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2\` (toujours passer l'ID à getFirestore())
- **Auth** : CUSTOM — admin/affilié/agent = credentials vérifiés dans Firestore. Client uniquement = Firebase Auth
- **Collections Firestore** : users, admins, affiliates, agents, parcels, products, formations, deposits, withdrawals, commissions, settings
- **Déploiement** : Replit (dev) + Vercel (prod via \`api/index.ts\`)

## Règles ABSOLUES de réponse
1. Réponds TOUJOURS en français
2. **JAMAIS de conseils génériques** qui s'appliquent à n'importe quel projet Node/React. Chaque réponse doit être spécifique à Solutionpam.
3. Cite toujours le fichier exact (\`src/api/router.ts\`, \`src/pages/AdminDashboard.tsx\`, etc.)
4. Pour du code : indique la fonction/section à modifier et fournis un extrait complet prêt à coller
5. Si tu ne sais pas quelque chose sur Solutionpam, dis-le clairement — ne devine pas
6. Ne suggère JAMAIS : react-query, express-cache, express-error-handler, react-router-dom, ou toute lib non déjà dans le projet
7. Libs déjà disponibles : shadcn/ui, Recharts, Framer Motion, Nodemailer, Zod — utilise-les si besoin
8. Format : ## sections, \`\`\`ts blocs de code, **gras** points importants`;



router.post('/api/admin/ai-chat', async (req, res) => {
  try {
    const { messages, apiKey } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      apiKey?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'messages[] requis.' });

    // Resolve key: body param → env var → Firestore ai_config (any agent key)
    let resolvedKey = apiKey?.trim() || process.env.GROQ_API_KEY || '';
    if (!resolvedKey) {
      try {
        if (adminDb) {
          const cfgSnap = await adminDb.collection('settings').doc('ai_config').get();
          if (cfgSnap.exists) {
            const cfg = cfgSnap.data() as Record<string, string>;
            resolvedKey = cfg.security || cfg.ui || cfg.performance || cfg.admin || '';
          }
        }
      } catch {}
    }
    if (!resolvedKey)
      return res.status(503).json({ error: 'Aucune clé Groq configurée. Ajoutez-en une dans le chat ou dans Analyse IA → Clés API.' });

    // Keep last 12 messages max to stay within context limit
    const trimmed = messages.slice(-12);

    const body = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: AI_CHAT_SYSTEM },
        ...trimmed,
      ],
      temperature: 0.15,
      max_tokens: 1200,
    });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resolvedKey}` },
      body,
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `Groq ${response.status}: ${errBody}` });
    }

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Réponse Groq vide.' });

    res.json({ reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur IA.' });
  }
});

// ── Ernst — Agent AI Assistant ────────────────────────────────────────────────
const ERNST_SYSTEM = `Tu es Ernst, l'assistant IA personnel des agents de la plateforme Solutionpam.
Solutionpam est une plateforme logistique et fintech multi-rôles basée en Haïti.

## Ton rôle
Tu aides les agents Solutionpam dans leurs tâches quotidiennes : dépôts, retraits, gestion des clients, commissions, portefeuille, procédures, et tout problème opérationnel qu'ils rencontrent.

## Ce que font les agents Solutionpam
- Effectuer des **dépôts** et **retraits** pour les clients (en HTG, converti en USD selon le taux du jour)
- Rechercher des clients par téléphone, nom ou ID Wallet
- Gérer leur propre portefeuille agent (solde en USD)
- Suivre leurs commissions sur les transactions
- Confirmer ou rejeter les demandes de retrait des clients
- Scanner les QR codes clients pour les identifier rapidement

## Flux opérationnels clés
- **Dépôt client** : rechercher le client → saisir le montant HTG → confirmer → le solde USD du client est crédité
- **Retrait client** : rechercher le client → saisir le montant → envoyer la demande → le client confirme → l'agent reçoit sa commission
- **Commission agent** : les agents gagnent un % sur chaque transaction (configuré par l'admin)
- **Taux de change** : 1 USD = taux HTG du jour (visible dans le dashboard)

## Règles de réponse
1. Réponds TOUJOURS en français, de manière concise et pratique
2. Sois direct — les agents travaillent sur le terrain, ils ont besoin de réponses rapides
3. Si une question concerne un problème technique, explique les étapes simples à suivre
4. Pour les problèmes de solde ou transactions, rappelle de contacter l'admin si nécessaire
5. Tu t'appelles Ernst — présente-toi ainsi si on te demande qui tu es
6. Sois chaleureux et encourageant — les agents font un travail important`;

router.post('/api/agent/ai-chat', async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'messages[] requis.' });

    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey)
      return res.status(503).json({ error: 'GROQ_API_KEY non configurée.' });

    const trimmed = messages.slice(-10);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: ERNST_SYSTEM },
          ...trimmed,
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `Groq ${response.status}: ${errBody}` });
    }

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Réponse vide.' });

    res.json({ reply });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur IA.' });
  }
});

// ── Client: request deposit via agent code (agent confirms) ──────────────────
router.post('/api/client/agent-deposit-request', requireDb, async (req, res) => {
  try {
    const { agentCode, clientId, clientName, amount } = req.body;
    if (!agentCode || !clientId || !amount) return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', String(agentCode).trim()).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable avec ce code.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(400).json({ error: 'Agent inactif.' });

    // Anti-double
    const existing = await adminDb.collection('client_agent_deposit_requests')
      .where('clientId', '==', clientId).where('status', '==', 'pending').limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: 'Une demande de dépôt est déjà en attente pour ce client.' });

    const reqRef = adminDb.collection('client_agent_deposit_requests').doc();
    await reqRef.set({
      agentId: agentDoc.id,
      agentCode: agentData.agentCode,
      agentName: agentData.name || '',
      clientId,
      clientName: clientName || '',
      amount: usd,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notify the agent by email
    if (agentData.email) {
      fireEmail(
        () => emailAgentNewRequest({ agentName: agentData.name || '', agentEmail: agentData.email, clientName: clientName || 'Client', type: 'deposit', amount: usd }),
        { type: 'agent_client_deposit_request', to: agentData.email, amount: usd },
      );
    }

    res.json({ success: true, agentName: agentData.name || '', requestId: reqRef.id });
  } catch (e: any) {
    console.error('[client/agent-deposit-request]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: fetch pending client deposit requests ───────────────────────────────
router.get('/api/agent/client-deposit-requests/:agentId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('client_agent_deposit_requests')
      .where('agentId', '==', req.params.agentId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc').get();
    res.json({ requests: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Agent: approve client deposit request ─────────────────────────────────────
router.post('/api/agent/client-deposit/:reqId/approve', requireDb, async (req, res) => {
  try {
    const { pin } = req.body;
    const reqRef = adminDb.collection('client_agent_deposit_requests').doc(req.params.reqId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    const agentRef = adminDb.collection('agents').doc(reqData.agentId);
    // Verify PIN before executing
    const agentPreSnap = await agentRef.get();
    if (!agentPreSnap.exists) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentPreData = agentPreSnap.data()!;
    if (!agentPreData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
    if (!pin || !verifyPin(String(pin), agentPreData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });
    const clientRef = adminDb.collection('clients').doc(reqData.clientId);

    // Load fee settings for commission calculation
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const feeSettings = settingsSnap.exists ? settingsSnap.data()! : {};
    const depositFeeMode = feeSettings.agentDepositFeeMode || 'percent';
    const depositCommissionPct = Number(feeSettings.agentDepositCommissionPercent || 0);
    const depositCommissionFixed = Number(feeSettings.agentDepositCommissionFixed || 0);
    let commissionAmount = 0;
    if (depositFeeMode === 'fixed') {
      commissionAmount = parseFloat(depositCommissionFixed.toFixed(4));
    } else if (depositCommissionPct > 0) {
      commissionAmount = parseFloat((reqData.amount * depositCommissionPct / 100).toFixed(4));
    }

    await adminDb.runTransaction(async (txn) => {
      const [latestReqSnap, agentSnap] = await Promise.all([
        txn.get(reqRef),
        txn.get(agentRef),
      ]);
      if (!latestReqSnap.exists || latestReqSnap.data()!.status !== 'pending') {
        throw new Error('Demande déjà traitée.');
      }
      if (latestReqSnap.data()!.agentId !== reqData.agentId) throw new Error('Accès refusé.');
      if (!agentSnap.exists) throw new Error('Agent introuvable.');
      const agentData = agentSnap.data()!;
      if ((agentData.balance || 0) < reqData.amount) throw new Error('Solde agent insuffisant pour ce dépôt.');

      txn.update(agentRef, {
        balance: FieldValue.increment(-reqData.amount),
        ...(commissionAmount > 0 && { commissionBalance: FieldValue.increment(commissionAmount) }),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.update(clientRef, { balance: FieldValue.increment(reqData.amount), updatedAt: FieldValue.serverTimestamp() });
      txn.update(reqRef, { status: 'approved', approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

      // Log in client_transactions
      txn.set(adminDb.collection('client_transactions').doc(), {
        clientId: reqData.clientId,
        clientName: reqData.clientName || '',
        agentId: reqData.agentId,
        agentCode: reqData.agentCode,
        agentName: reqData.agentName || '',
        type: 'deposit',
        amount: reqData.amount,
        status: 'approved',
        method: 'Agent',
        source: 'client_agent_deposit',
        description: `Dépôt approuvé par Agent ${reqData.agentName}`,
        ...(commissionAmount > 0 && { agentCommission: commissionAmount }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Fee record for commission tracking
      if (commissionAmount > 0) {
        txn.set(adminDb.collection('agent_fee_records').doc(), {
          agentId: reqData.agentId,
          agentCode: reqData.agentCode,
          agentName: reqData.agentName || '',
          clientId: reqData.clientId,
          clientName: reqData.clientName || '',
          operationType: 'deposit',
          baseAmount: reqData.amount,
          feeTotal: commissionAmount,
          agentShare: commissionAmount,
          adminShare: 0,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // Client notification
      txn.set(adminDb.collection('client_notifications').doc(), {
        clientId: reqData.clientId,
        type: 'deposit_approved',
        title: '✅ Dépôt confirmé',
        message: `Votre dépôt de ${reqData.amount.toFixed(2)} a été approuvé par l'agent ${reqData.agentName}.`,
        amount: reqData.amount,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Email: agent processed the deposit (notify admin + client)
    adminDb.collection('clients').doc(reqData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: reqData.agentName || '', clientName: reqData.clientName || '', clientEmail, type: 'deposit', action: 'confirmed', amount: reqData.amount }),
        { type: 'agent_client_deposit_approved_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: reqData.clientId, amount: reqData.amount },
      );
    }).catch(() => {});

    // Push notification to client
    sendFcmToClient(
      reqData.clientId,
      '✅ Dépôt confirmé',
      `Votre dépôt de ${reqData.amount.toFixed(2)} a été approuvé par l'agent ${reqData.agentName}.`,
      { type: 'deposit_approved' }
    );

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Agent: reject client deposit request ──────────────────────────────────────
router.post('/api/agent/client-deposit/:reqId/reject', requireDb, async (req, res) => {
  try {
    const { reason, pin } = req.body;
    const reqRef = adminDb.collection('client_agent_deposit_requests').doc(req.params.reqId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });
    // Verify PIN before rejecting
    const agentRejectSnap = await adminDb.collection('agents').doc(reqData.agentId).get();
    if (agentRejectSnap.exists) {
      const agentRejectData = agentRejectSnap.data()!;
      if (!agentRejectData.pinHash) return res.status(403).json({ error: 'Code PIN non configuré. Veuillez définir votre PIN.' });
      if (!pin || !verifyPin(String(pin), agentRejectData.pinHash)) return res.status(403).json({ error: 'Code PIN incorrect.' });
    }

    await adminDb.runTransaction(async (txn) => {
      const latestReqSnap = await txn.get(reqRef);
      if (!latestReqSnap.exists || latestReqSnap.data()!.status !== 'pending') {
        throw new Error('Demande déjà traitée.');
      }
      if (latestReqSnap.data()!.agentId !== reqData.agentId) throw new Error('Accès refusé.');
      txn.update(reqRef, { status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      txn.set(adminDb.collection('client_notifications').doc(), {
        clientId: reqData.clientId,
        type: 'deposit_rejected',
        title: '❌ Demande de dépôt refusée',
        message: `Votre demande de dépôt de ${(reqData.amount || 0).toFixed(2)} a été refusée par l'agent ${reqData.agentName}.${reason ? ` Raison: ${reason}` : ''}`,
        amount: reqData.amount,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // Push + email to client
    sendFcmToClient(
      reqData.clientId,
      '❌ Dépôt refusé',
      `Votre demande de dépôt de ${(reqData.amount || 0).toFixed(2)} a été refusée par l'agent ${reqData.agentName}.`,
      { type: 'deposit_rejected' }
    );

    adminDb.collection('clients').doc(reqData.clientId).get().then(cSnap => {
      const clientEmail = cSnap.exists ? cSnap.data()?.email : undefined;
      fireEmail(
        () => emailAgentProcessed({ agentName: reqData.agentName || '', clientName: reqData.clientName || '', clientEmail, type: 'deposit', action: 'rejected', amount: reqData.amount, reason }),
        { type: 'agent_client_deposit_rejected_email', to: [ADMIN_EMAIL, ...(clientEmail ? [clientEmail] : [])], clientId: reqData.clientId, amount: reqData.amount },
      );
    }).catch(() => {});

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: list all agent personal transactions ───────────────────────────────
router.get('/api/admin/agent-personal-transactions', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('agent_personal_transactions')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc').limit(200).get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH photo URL (affiliate / agent) ──────────────────────────────────────
router.patch('/api/affiliate/:id/photo', requireDb, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    if (typeof photoUrl !== 'string') return res.status(400).json({ error: 'photoUrl requis.' });
    await adminDb.collection('affiliates').doc(req.params.id).update({ photoUrl, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/agent/:id/photo', requireDb, async (req, res) => {
  try {
    const { photoUrl } = req.body;
    if (typeof photoUrl !== 'string') return res.status(400).json({ error: 'photoUrl requis.' });
    await adminDb.collection('agents').doc(req.params.id).update({ photoUrl, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Test email (admin only) ───────────────────────────────────────────────────
router.post('/api/admin/test-email', async (req, res) => {
  const { to } = req.body as { to?: string };
  const recipient = to || process.env.ADMIN_EMAIL;
  if (!recipient) {
    return res.status(400).json({ error: 'Aucun destinataire fourni et ADMIN_EMAIL non configuré.' });
  }
  const { send, FROM_EMAIL } = await import('../lib/email.ts');
  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;">
    <h2 style="color:#059669;">✅ Test email Resend</h2>
    <p>Si vous lisez ceci, Resend est correctement configuré sur <strong>Solutionpam</strong>.</p>
    <table style="border-collapse:collapse;width:100%;max-width:400px;">
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">FROM</td><td style="padding:8px;border:1px solid #eee;">${FROM_EMAIL}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">TO</td><td style="padding:8px;border:1px solid #eee;">${recipient}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">Date</td><td style="padding:8px;border:1px solid #eee;">${new Date().toLocaleString('fr-FR')}</td></tr>
    </table>
  </body></html>`;
  const result = await send(recipient, '✅ Test email Solutionpam — Resend opérationnel', html, 'test_email');
  if (result.success) {
    return res.json({ ok: true, id: result.id, from: FROM_EMAIL, to: recipient });
  }
  return res.status(500).json({ ok: false, error: result.error });
});

// ── NOWPayments — Crypto top-up ───────────────────────────────────────────────

const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';

function sortObjectRecursive(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortObjectRecursive);
  return Object.keys(obj as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = sortObjectRecursive((obj as Record<string, unknown>)[k]);
    return acc;
  }, {});
}

async function nowPayFetch(path: string, method = 'GET', body?: object) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY non configurée côté serveur.');
  const opts: Record<string, unknown> = {
    method,
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${NOWPAYMENTS_BASE}${path}`, opts as RequestInit);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { message?: string }).message || `NOWPayments error ${r.status}`);
  return data;
}

async function creditCryptoPayment(
  docRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
) {
  // Read deposit fee from settings (authoritative server-side calculation)
  let feePercent = 0;
  try {
    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    feePercent = Number(settingsSnap.data()?.depositFeePercent || 0);
  } catch { /* non-fatal — apply no fee if settings unreadable */ }

  await adminDb.runTransaction(async (txn) => {
    const fresh = await txn.get(docRef);
    if (!fresh.exists || fresh.data()?.credited) return; // already credited — skip
    const clientRef = adminDb.collection('clients').doc(data.clientId as string);
    const txRef     = adminDb.collection('client_transactions').doc();
    const grossAmount = data.amount as number;
    const feeAmount   = feePercent > 0 ? parseFloat((grossAmount * feePercent / 100).toFixed(4)) : 0;
    const netAmount   = parseFloat((grossAmount - feeAmount).toFixed(4));
    txn.set(txRef, {
      clientId:       data.clientId,
      clientName:     data.clientName || '',
      clientWalletId: data.clientWalletId || '',
      type:           'deposit',
      amount:         netAmount,
      grossAmount,
      feeAmount,
      feePercent,
      status:         'approved',
      method:         'crypto',
      currency:       data.currency,
      txId:           String(data.paymentId),
      description:    `Recharge crypto (${String(data.currency || '').toUpperCase()}) — ${netAmount.toFixed(2)} USD${feeAmount > 0 ? ` (frais: ${feeAmount.toFixed(2)} USD)` : ''}`,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });
    txn.update(clientRef, { balance: FieldValue.increment(netAmount), updatedAt: FieldValue.serverTimestamp() });
    txn.update(docRef, { credited: true, creditedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  // Notify client
  const grossAmount = data.amount as number;
  const feeAmount   = feePercent > 0 ? parseFloat((grossAmount * feePercent / 100).toFixed(4)) : 0;
  const netAmount   = parseFloat((grossAmount - feeAmount).toFixed(4));
  try {
    await sendFcmToClient(
      data.clientId as string,
      '✅ Paiement crypto confirmé',
      `Votre compte a été rechargé de ${netAmount.toFixed(2)} USD.`,
      { type: 'deposit', method: 'crypto' }
    );
  } catch { /* non-fatal */ }
}

// POST /api/crypto/create-payment
router.post('/api/crypto/create-payment', requireDb, async (req, res) => {
  try {
    const { clientId, clientName, clientWalletId, amount, currency } = req.body;
    if (!clientId || !amount || !currency)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    if (Number(amount) <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });
    const allowed = ['usdttrc20', 'usdc', 'btc'];
    if (!allowed.includes(currency))
      return res.status(400).json({ error: 'Cryptomonnaie non supportée.' });

    // Build IPN callback URL from REPLIT_DEV_DOMAIN or APP_URL
    const domain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : (process.env.APP_URL || '');
    const ipnCallbackUrl = `${domain}/api/crypto/ipn`;
    const orderId = `SPM-${String(clientId).slice(0, 8)}-${Date.now()}`;

    const payment = await nowPayFetch('/payment', 'POST', {
      price_amount:        Number(amount),
      price_currency:      'usd',
      pay_currency:        currency,
      order_id:            orderId,
      order_description:   `Recharge portefeuille — ${clientName || clientId}`,
      ipn_callback_url:    ipnCallbackUrl,
      is_fee_paid_by_user: true,
    }) as Record<string, unknown>;

    await adminDb.collection('crypto_payments').doc(String(payment.payment_id)).set({
      paymentId:      String(payment.payment_id),
      clientId,
      clientName:     clientName || '',
      clientWalletId: clientWalletId || '',
      orderId,
      amount:         Number(amount),
      currency,
      status:         payment.payment_status || 'waiting',
      credited:       false,
      payAddress:     payment.pay_address || '',
      payAmount:      payment.pay_amount  || 0,
      payCurrency:    payment.pay_currency || currency,
      expirationDate: payment.expiration_estimate_date || null,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
    });

    console.log(`[crypto] Payment ${payment.payment_id} created for ${clientId} — ${amount} → ${currency}`);
    res.json(payment);
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[crypto/create-payment]', err.message);
    // Give a clear user-facing message for NOWPayments minimum-amount rejection
    const msg = err.message || '';
    const isAmountTooSmall = /too small|minimum|amount/i.test(msg);
    const userMessage = isAmountTooSmall
      ? 'Montant trop faible pour cette cryptomonnaie. Veuillez augmenter le montant et réessayer.'
      : (msg || 'Erreur serveur.');
    res.status(isAmountTooSmall ? 400 : 500).json({ error: userMessage });
  }
});

// GET /api/crypto/payment-status/:paymentId
router.get('/api/crypto/payment-status/:paymentId', requireDb, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const docRef  = adminDb.collection('crypto_payments').doc(paymentId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Paiement introuvable.' });
    const data = docSnap.data()!;

    const payment = await nowPayFetch(`/payment/${paymentId}`) as Record<string, unknown>;
    const newStatus = payment.payment_status as string;
    await docRef.update({ status: newStatus, updatedAt: FieldValue.serverTimestamp() });

    if (newStatus === 'finished' && !data.credited) {
      await creditCryptoPayment(docRef, data);
    }

    res.json({ ...payment, credited: newStatus === 'finished' });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[crypto/payment-status]', err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// POST /api/crypto/ipn  — NOWPayments webhook
router.post('/api/crypto/ipn', async (req, res) => {
  try {
    const sig       = req.headers['x-nowpayments-sig'] as string | undefined;
    const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
    // SECURITY: signature verification is MANDATORY. Without a valid secret configured,
    // any attacker could POST a fake payment_status: 'finished' to credit accounts.
    if (!ipnSecret) {
      console.error('[crypto/ipn] NOWPAYMENTS_IPN_SECRET non configuré — webhook rejeté par sécurité.');
      return res.status(500).json({ error: 'Configuration IPN manquante.' });
    }
    if (!sig) {
      console.warn('[crypto/ipn] Requête sans signature — rejetée');
      return res.status(401).json({ error: 'Signature manquante.' });
    }
    const sorted   = JSON.stringify(sortObjectRecursive(req.body));
    const expected = createHmac('sha512', ipnSecret).update(sorted).digest('hex');
    if (sig.toLowerCase() !== expected.toLowerCase()) {
      console.warn('[crypto/ipn] Signature invalide — rejeté');
      return res.status(401).json({ error: 'Signature invalide.' });
    }
    const { payment_id, payment_status } = req.body as { payment_id?: string; payment_status?: string };
    if (!payment_id) return res.sendStatus(200);

    const docRef  = adminDb.collection('crypto_payments').doc(String(payment_id));
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.sendStatus(200);

    const data = docSnap.data()!;
    await docRef.update({ status: payment_status, updatedAt: FieldValue.serverTimestamp() });
    if (payment_status === 'finished' && !data.credited) {
      await creditCryptoPayment(docRef, data);
    }
    console.log(`[crypto/ipn] payment_id=${payment_id} status=${payment_status}`);
    res.sendStatus(200); // Always 200 so NOWPayments doesn't retry
  } catch (e: unknown) {
    console.error('[crypto/ipn]', (e as Error).message);
    res.sendStatus(200);
  }
});

// ── FazerCards API proxy ──────────────────────────────────────────────────────
const FAZER_BASE = 'https://api.fzr.cards/api/v2';
function hasFazerCredentials(): boolean {
  return Boolean(process.env.FAZERCARDS_API_KEY || process.env.FAZER_CARDS_API_KEY);
}

function fazerFetch(path: string, opts: RequestInit = {}) {
  const key = process.env.FAZERCARDS_API_KEY || process.env.FAZER_CARDS_API_KEY;
  if (!key) throw new Error('FAZERCARDS_API_KEY non configurée.');
  return fetch(`${FAZER_BASE}${path}`, {
    ...opts,
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

// GET /api/fazer/topups — list game categories (with cover images)
router.get('/api/fazer/topups', async (_req, res) => {
  if (!hasFazerCredentials()) return res.json({ items: [], available: false });
  try {
    const r = await fazerFetch('/topups?include_ui=1&limit=100');
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards.' });
    const data = await r.json() as any;
    // Normalise: FazerCards returns { items: [...] } or array
    const items = Array.isArray(data) ? data : (data.items || data.data || []);
    res.json({ items });
  } catch (e: any) {
    console.error('[fazer/topups]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// GET /api/fazer/topups/offers?category_id=X
router.get('/api/fazer/topups/offers', async (req, res) => {
  try {
    const { category_id } = req.query as { category_id?: string };
    if (!category_id) return res.status(400).json({ error: 'category_id requis.' });
    if (!hasFazerCredentials()) return res.json({ items: [], fields: [], available: false });
    const r = await fazerFetch(`/topups/offers?category_id=${encodeURIComponent(category_id)}&include_ui=1`);
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards.' });
    const data = await r.json() as any;
    const raw: any[] = Array.isArray(data) ? data : (data.items || data.offers || data.data || []);
    // Normalise: map price_usd (string) → price (float), keep other fields
    const items = raw.map((o: any) => ({
      ...o,
      price: typeof o.price === 'number' ? o.price : parseFloat(o.price_usd ?? o.price ?? '0') || 0,
    }));
    // Include fields (player ID requirements) from the API response
    const fields = data.fields || [];
    res.json({ items, fields });
  } catch (e: any) {
    console.error('[fazer/topups/offers]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// GET /api/fazer/topups/validate-id — list games that support ID validation
router.get('/api/fazer/topups/validate-id', async (_req, res) => {
  if (!hasFazerCredentials()) return res.json([]);
  try {
    const r = await fazerFetch('/topups/validate-id');
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards.' });
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// POST /api/fazer/topups/validate-id — validate a player ID
// FazerCards only supports validation for 3 base IDs: free_fire, pubg_mobile, mobile_legends
// Map any variant (free_fire_latam, mobile_legends_global, etc.) to the canonical ID.
const VALIDATE_ID_MAP: Record<string, string> = {
  // Free Fire variants → free_fire
  free_fire_latam: 'free_fire', free_fire_br: 'free_fire', free_fire_eu: 'free_fire',
  free_fire_id: 'free_fire', free_fire_th: 'free_fire', free_fire_vn: 'free_fire',
  free_fire_my_sg: 'free_fire', free_fire_sg: 'free_fire', free_fire_ph: 'free_fire',
  free_fire_bd: 'free_fire', free_fire_pk: 'free_fire', free_fire_tw: 'free_fire',
  free_fire_cis: 'free_fire', free_fire_mena: 'free_fire',
  // Mobile Legends variants → mobile_legends
  mobile_legends_global: 'mobile_legends', mobile_legends_brazil: 'mobile_legends',
  mobile_legends_indonesia: 'mobile_legends', mobile_legends_philippines: 'mobile_legends',
  mobile_legends_malaysia: 'mobile_legends', mobile_legends_singapore: 'mobile_legends',
  mobile_legends_united_states: 'mobile_legends', mobile_legends_exclusive: 'mobile_legends',
  mobile_legends_special: 'mobile_legends', mobile_legends_promo: 'mobile_legends',
  // PUBG variants → pubg_mobile
  pubg_mobile_global: 'pubg_mobile',
};

router.post('/api/fazer/topups/validate-id', async (req, res) => {
  try {
    const body = { ...req.body };
    // Remap category_id to a validatable one if needed
    if (body.category_id && VALIDATE_ID_MAP[body.category_id]) {
      body.category_id = VALIDATE_ID_MAP[body.category_id];
    }
    const r = await fazerFetch('/topups/validate-id', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await r.json() as any;
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error || 'Validation impossible pour ce jeu.' });
    }
    // Normalise response for the frontend
    res.json({
      ok: true,
      valid: data.valid ?? true,
      username: data.player_name || data.username || data.name || null,
      player_id: data.player_id || body.fields?.player_id || null,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Erreur serveur lors de la validation.' });
  }
});

// POST /api/fazer/topups/order — place order, deduct wallet
router.post('/api/fazer/topups/order', requireDb, requireClientSession, async (req, res) => {
  try {
    const { category_id, offer_id, fields } = req.body as {
      category_id: string; offer_id: string;
      fields: Record<string, string>;
    };
    const clientId = String(res.locals.clientSession.clientId);
    // NOTE: priceUSD from client is intentionally ignored — price is fetched server-side.
    if (!category_id || !offer_id) return res.status(400).json({ error: 'Paramètres manquants.' });
    if (!hasFazerCredentials()) return res.status(503).json({ error: 'Les services Fazerscards sont en cours d’activation.' });

    // SECURITY: Fetch the real price from FazerCards server-side.
    // Never trust priceUSD sent by the client — a malicious user could send 0.
    let price = 0;
    try {
      const offersRes = await fazerFetch(`/topups/offers?category_id=${encodeURIComponent(category_id)}&include_ui=1`);
      if (offersRes.ok) {
        const offersData = await offersRes.json() as any;
        const offersList: any[] = Array.isArray(offersData) ? offersData : (offersData.items || offersData.offers || offersData.data || []);
        const matchedOffer = offersList.find((o: any) => String(o.id || o.offer_id) === String(offer_id));
        if (matchedOffer) {
          price = typeof matchedOffer.price === 'number'
            ? matchedOffer.price
            : parseFloat(matchedOffer.price_usd ?? matchedOffer.price ?? '0') || 0;
        }
      }
    } catch (priceErr: any) {
      console.warn('[fazer/order] Could not fetch offer price server-side:', priceErr.message);
    }

    if (price <= 0) return res.status(422).json({ error: 'Cette offre Fazerscards n’est plus disponible. Veuillez choisir une autre offre.' });

    // 1. Atomically verify balance and place order using runTransaction
    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if (price > 0 && (clientData.balance || 0) < price)
      return res.status(400).json({ error: `Solde insuffisant. Disponible: ${clientData.balance?.toFixed(2)} USD.` });

    // 2. Place order with FazerCards (before deducting wallet, to avoid deducting on API failure)
    const idempotencyKey = `rena-${clientId}-${Date.now()}`;
    const fazerRes = await fazerFetch('/topups/order', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey } as any,
      body: JSON.stringify({ category_id, offer_id, fields }),
    });
    const fazerData = await fazerRes.json() as any;
    if (!fazerRes.ok) {
      console.error('[fazer/order] FazerCards error:', fazerData);
      return res.status(fazerRes.status).json({ error: fazerData.message || fazerData.error || 'Erreur FazerCards.' });
    }

    // 3. SECURITY: Atomically deduct wallet using runTransaction to prevent race conditions
    const txRef = adminDb.collection('client_transactions').doc();
    await adminDb.runTransaction(async (txn) => {
      const freshSnap = await txn.get(clientRef);
      if (!freshSnap.exists) throw new Error('Client introuvable.');
      const freshData = freshSnap.data()!;
      if (price > 0 && (freshData.balance || 0) < price) throw new Error(`Solde insuffisant. Disponible: ${freshData.balance?.toFixed(2)} USD.`);

      if (price > 0) {
        txn.update(clientRef, { balance: FieldValue.increment(-price), updatedAt: FieldValue.serverTimestamp() });
      }
      txn.set(txRef, {
        clientId, clientName: clientData.name || '',
        type: 'purchase', amount: price, status: 'completed',
        productName: fazerData.category_name || category_id,
        productPrice: `${price} USD`,
        description: `Top-up jeu: ${fazerData.category_name || category_id} (${fazerData.order_id || idempotencyKey})`,
        fazerOrderId: fazerData.order_id || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    res.json({ success: true, order: fazerData, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[fazer/order]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── FazerCards price overrides (admin) ───────────────────────────────────────
// GET /api/fazer/price-overrides — returns { overrides: { [offerId]: number (HTG) } }
router.get('/api/fazer/price-overrides', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('fazerPriceOverrides').get();
    const overrides: Record<string, number> = {};
    snap.forEach(doc => { overrides[doc.id] = doc.data().customPriceHTG; });
    res.json({ overrides });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/fazer/price-overrides — save or delete a custom HTG price
router.post('/api/fazer/price-overrides', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { offerId, customPriceHTG } = req.body as { offerId: string; customPriceHTG: number | null };
    if (!offerId) return res.status(400).json({ error: 'offerId requis.' });
    const ref = adminDb.collection('fazerPriceOverrides').doc(offerId);
    if (customPriceHTG === null || customPriceHTG === undefined) {
      await ref.delete();
    } else {
      await ref.set({ customPriceHTG: Number(customPriceHTG), updatedAt: FieldValue.serverTimestamp() });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── FazerCards Gift Cards ─────────────────────────────────────────────────────

// GET /api/fazer/giftcards — list gift card categories
router.get('/api/fazer/giftcards', async (_req, res) => {
  if (!hasFazerCredentials()) return res.json({ items: [], available: false });
  try {
    const r = await fazerFetch('/giftcards?include_ui=1&limit=100');
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards Gift Cards.' });
    const data = await r.json() as any;
    const items = Array.isArray(data) ? data : (data.items || data.data || []);
    res.json({ items });
  } catch (e: any) {
    console.error('[fazer/giftcards]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// GET /api/fazer/giftcards/offers?category_id=X
router.get('/api/fazer/giftcards/offers', async (req, res) => {
  try {
    const { category_id } = req.query as { category_id?: string };
    if (!category_id) return res.status(400).json({ error: 'category_id requis.' });
    if (!hasFazerCredentials()) return res.json({ items: [], available: false });
    const r = await fazerFetch(`/giftcards/cards?category_id=${encodeURIComponent(category_id)}`);
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards.' });
    const data = await r.json() as any;
    const raw: any[] = Array.isArray(data) ? data : (data.items || data.cards || data.offers || data.data || []);
    const items = raw.map((o: any) => ({
      ...o,
      offer_id: String(o.offer_id || o.card_id || o.id || ''),
      price: typeof o.price === 'number' ? o.price : parseFloat(o.price_usd ?? o.price ?? '0') || 0,
    }));
    res.json({ items });
  } catch (e: any) {
    console.error('[fazer/giftcards/offers]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// POST /api/fazer/giftcards/order — purchase a gift card and deduct wallet
router.post('/api/fazer/giftcards/order', requireDb, requireClientSession, async (req, res) => {
  try {
    const { category_id, offer_id } = req.body as {
      category_id: string; offer_id: string;
    };
    const clientId = String(res.locals.clientSession.clientId);
    // NOTE: priceUSD from client is intentionally ignored — price is fetched server-side.
    if (!category_id || !offer_id) return res.status(400).json({ error: 'Paramètres manquants.' });
    if (!hasFazerCredentials()) return res.status(503).json({ error: 'Les services Fazerscards sont en cours d’activation.' });

    // SECURITY: Fetch the real price from FazerCards server-side.
    let price = 0;
    try {
      const offersRes = await fazerFetch(`/giftcards/cards?category_id=${encodeURIComponent(category_id)}`);
      if (offersRes.ok) {
        const offersData = await offersRes.json() as any;
        const offersList: any[] = Array.isArray(offersData) ? offersData : (offersData.items || offersData.cards || offersData.offers || offersData.data || []);
        const matchedOffer = offersList.find((o: any) => String(o.card_id || o.id || o.offer_id) === String(offer_id));
        if (matchedOffer) {
          price = typeof matchedOffer.price === 'number'
            ? matchedOffer.price
            : parseFloat(matchedOffer.price_usd ?? matchedOffer.price ?? '0') || 0;
        }
      }
    } catch (priceErr: any) {
      console.warn('[fazer/giftcards/order] Could not fetch offer price server-side:', priceErr.message);
    }

    if (price <= 0) return res.status(422).json({ error: 'Cette offre Fazerscards n’est plus disponible. Veuillez choisir une autre offre.' });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if (price > 0 && (clientData.balance || 0) < price)
      return res.status(400).json({ error: `Solde insuffisant. Disponible: ${clientData.balance?.toFixed(2)} USD.` });

    const idempotencyKey = `rena-gc-${clientId}-${Date.now()}`;
    const fazerRes = await fazerFetch('/giftcards/order', {
      method: 'POST',
      headers: { 'idempotency-key': idempotencyKey } as any,
      body: JSON.stringify({ category_id, card_id: offer_id, quantity: 1 }),
    });
    const fazerData = await fazerRes.json() as any;
    if (!fazerRes.ok) {
      console.error('[fazer/giftcards/order] error:', fazerData);
      return res.status(fazerRes.status).json({ error: fazerData.message || fazerData.error || 'Erreur commande.' });
    }

    // SECURITY: Atomically deduct wallet using runTransaction
    const txRef = adminDb.collection('client_transactions').doc();
    await adminDb.runTransaction(async (txn) => {
      const freshSnap = await txn.get(clientRef);
      if (!freshSnap.exists) throw new Error('Client introuvable.');
      const freshData = freshSnap.data()!;
      if (price > 0 && (freshData.balance || 0) < price) throw new Error(`Solde insuffisant. Disponible: ${freshData.balance?.toFixed(2)} USD.`);

      if (price > 0) {
        txn.update(clientRef, { balance: FieldValue.increment(-price), updatedAt: FieldValue.serverTimestamp() });
      }
      txn.set(txRef, {
        clientId, clientName: clientData.name || '',
        type: 'purchase', amount: price, status: 'completed',
        productName: fazerData.category_name || fazerData.order?.category_name || category_id,
        productPrice: `${price} USD`,
        description: `Carte-cadeau: ${fazerData.category_name || fazerData.order?.category_name || category_id} (${fazerData.order_id || fazerData.order?.id || idempotencyKey})`,
        fazerOrderId: fazerData.order_id || fazerData.order?.id || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const order = fazerData.order || fazerData;
    const code = order.code || order.pin || order.serial || order.card_number || null;
    res.json({ success: true, order: fazerData, code });
  } catch (e: any) {
    console.error('[fazer/giftcards/order]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Free Fire Reseller ────────────────────────────────────────────────────────
// Regions → FazerCards category_id
const FF_REGIONS: Record<string, string> = {
  'LATAM':       'free_fire_latam',
  'Brésil':      'free_fire_br',
  'Europe':      'free_fire_eu',
  'Indonésie':   'free_fire_id',
  'Thaïlande':   'free_fire_th',
  'Vietnam':     'free_fire_vn',
  'MY/SG':       'free_fire_my_sg',
  'Philippines': 'free_fire_ph',
  'Bangladesh':  'free_fire_bd',
  'Pakistan':    'free_fire_pk',
  'Taiwan':      'free_fire_tw',
  'CIS':         'free_fire_cis',
  'MENA':        'free_fire_mena',
};
const FALLBACK_FF_PACKAGES = [
  { id: 'ff_100',  label: '100 Diamants',  diamonds: 100,  priceUSD: 0.99,  offerId: 'ff_100',  categoryId: 'free_fire_latam' },
  { id: 'ff_310',  label: '310 Diamants',  diamonds: 310,  priceUSD: 2.99,  offerId: 'ff_310',  categoryId: 'free_fire_latam' },
  { id: 'ff_520',  label: '520 Diamants',  diamonds: 520,  priceUSD: 4.99,  offerId: 'ff_520',  categoryId: 'free_fire_latam' },
  { id: 'ff_1060', label: '1060 Diamants', diamonds: 1060, priceUSD: 9.99,  offerId: 'ff_1060', categoryId: 'free_fire_latam' },
  { id: 'ff_2180', label: '2180 Diamants', diamonds: 2180, priceUSD: 19.99, offerId: 'ff_2180', categoryId: 'free_fire_latam' },
  { id: 'ff_5600', label: '5600 Diamants', diamonds: 5600, priceUSD: 49.99, offerId: 'ff_5600', categoryId: 'free_fire_latam' },
];

// POST /api/reseller/ff/ensure-account — auto-create at 0 💎 if not exists
router.post('/api/reseller/ff/ensure-account', requireDb, async (req, res) => {
  try {
    const { agentId, agentName } = req.body as { agentId: string; agentName?: string };
    if (!agentId) return res.status(400).json({ error: 'agentId requis.' });
    const ref = adminDb.collection('agent_reseller_accounts').doc(agentId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        agentId, agentName: agentName || '',
        enabled: true, diamondBalance: 0, totalSold: 0, totalOrders: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      const fresh = await ref.get();
      return res.json({ account: { id: fresh.id, ...fresh.data() }, created: true });
    }
    res.json({ account: { id: snap.id, ...snap.data() }, created: false });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reseller/ff/account
router.get('/api/reseller/ff/account', requireDb, async (req, res) => {
  try {
    const { agentId } = req.query as { agentId?: string };
    if (!agentId) return res.status(400).json({ error: 'agentId requis.' });
    const snap = await adminDb.collection('agent_reseller_accounts').doc(agentId).get();
    if (!snap.exists) return res.json({ account: null });
    res.json({ account: { id: snap.id, ...snap.data() } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reseller/ff/packages?region=LATAM
router.get('/api/reseller/ff/packages', async (req, res) => {
  try {
    const { region } = req.query as { region?: string };
    const categoryId = (region && FF_REGIONS[region]) ? FF_REGIONS[region] : 'free_fire_latam';
    const r = await fazerFetch(`/topups/offers?category_id=${encodeURIComponent(categoryId)}&include_ui=1`);
    const data = await r.json() as any;
    if (!r.ok) return res.json({ items: FALLBACK_FF_PACKAGES, regions: Object.keys(FF_REGIONS) });
    const raw: any[] = Array.isArray(data) ? data : (data.items || data.offers || data.data || []);
    const items = raw.map((o: any) => ({
      id: o.id || o.offer_id || String(o.diamonds || o.value),
      label: o.name || o.product_name || `${o.diamonds || o.value || '?'} Diamants`,
      diamonds: parseInt(String(o.diamonds || o.value || 0)) || 0,
      priceUSD: parseFloat(String(o.price_usd || o.price || 0)) || 0,
      offerId: o.offer_id || o.id || String(o.diamonds),
      categoryId,
    })).filter(o => o.diamonds > 0);
    res.json({ items: items.length ? items : FALLBACK_FF_PACKAGES, regions: Object.keys(FF_REGIONS) });
  } catch (e: any) {
    console.error('[reseller/ff/packages]', e.message);
    res.json({ items: FALLBACK_FF_PACKAGES, regions: Object.keys(FF_REGIONS) });
  }
});

// GET /api/reseller/ff/transactions?agentId=X
router.get('/api/reseller/ff/transactions', requireDb, async (req, res) => {
  try {
    const { agentId, limit: lStr } = req.query as { agentId?: string; limit?: string };
    if (!agentId) return res.status(400).json({ error: 'agentId requis.' });
    const limit = Math.min(parseInt(lStr || '50'), 100);
    const snap = await adminDb.collection('free_fire_transactions')
      .where('agentId', '==', agentId)
      .orderBy('createdAt', 'desc').limit(limit).get();
    res.json({ transactions: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/reseller/ff/order
router.post('/api/reseller/ff/order', requireDb, async (req, res) => {
  try {
    const { agentId, playerId, region, offerId, categoryId, diamonds, packageLabel, priceUSD } = req.body as {
      agentId: string; playerId: string; region: string; offerId: string;
      categoryId: string; diamonds: number; packageLabel: string; priceUSD: number;
    };
    if (!agentId || !playerId || !region || !offerId || !categoryId)
      return res.status(400).json({ error: 'Paramètres manquants.' });

    // 1. Verify reseller account
    const accountRef = adminDb.collection('agent_reseller_accounts').doc(agentId);
    const txRef = adminDb.collection('free_fire_transactions').doc();
    // Reserve reseller credit before external fulfillment so concurrent orders
    // cannot spend the same diamonds.
    await adminDb.runTransaction(async (txn) => {
      const accountSnap = await txn.get(accountRef);
      if (!accountSnap.exists) throw new Error("Compte revendeur non configuré. Contactez l'administrateur.");
      const account = accountSnap.data()!;
      if (!account.enabled) throw new Error("Compte revendeur désactivé. Contactez l'administrateur.");
      if ((account.diamondBalance || 0) < diamonds) {
        throw new Error(`Crédit insuffisant. Disponible : ${account.diamondBalance || 0} 💎`);
      }
      txn.update(accountRef, {
        diamondBalance: FieldValue.increment(-Number(diamonds)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(txRef, {
        agentId, agentName: account.agentName || '', playerId, region, packageLabel,
        diamonds: Number(diamonds), priceUSD: Number(priceUSD) || 0, offerId, categoryId,
        status: 'pending', apiResponse: null, errorMessage: null, fazerOrderId: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // 3. Call FazerCards
    const idempotencyKey = `rena-reseller-${agentId}-${txRef.id}`;
    let fazerData: any = null;
    let success = false;
    let errorMessage: string | null = null;
    try {
      const fazerRes = await fazerFetch('/topups/order', {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey } as any,
        body: JSON.stringify({ category_id: categoryId, offer_id: offerId, fields: { player_id: playerId } }),
      });
      fazerData = await fazerRes.json();
      if (!fazerRes.ok) {
        errorMessage = fazerData?.message || fazerData?.error || 'Erreur FazerCards.';
      } else { success = true; }
    } catch (apiErr: any) { errorMessage = apiErr.message || 'Erreur réseau FazerCards.'; }

    // Finalize the reservation, or compensate it if fulfillment failed.
    await adminDb.runTransaction(async (txn) => {
      const latestTx = await txn.get(txRef);
      if (!latestTx.exists || latestTx.data()!.status !== 'pending') throw new Error('Commande déjà finalisée.');
      txn.update(txRef, {
        status: success ? 'success' : 'failed',
        apiResponse: fazerData, fazerOrderId: fazerData?.order_id || null,
        errorMessage, updatedAt: FieldValue.serverTimestamp(),
      });
      txn.update(accountRef, success ? {
        totalSold: FieldValue.increment(Number(diamonds)),
        totalOrders: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      } : {
        diamondBalance: FieldValue.increment(Number(diamonds)),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (!success) return res.status(400).json({ error: errorMessage, transactionId: txRef.id });
    res.json({ success: true, transactionId: txRef.id, order: fazerData });
  } catch (e: any) {
    console.error('[reseller/ff/order]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// GET /api/admin/reseller/ff/packs — configurable diamond credit packs
const DEFAULT_FF_PACKS = [
  { id: 'pack_5000',  label: 'Pack 5 000',  diamonds: 5000,  priceUSD: 45 },
  { id: 'pack_10000', label: 'Pack 10 000', diamonds: 10000, priceUSD: 85 },
  { id: 'pack_15000', label: 'Pack 15 000', diamonds: 15000, priceUSD: 120 },
  { id: 'pack_20000', label: 'Pack 20 000', diamonds: 20000, priceUSD: 155 },
];
router.get('/api/admin/reseller/ff/packs', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('ff_credit_packs').get();
    const packs = snap.exists ? (snap.data()!.packs || DEFAULT_FF_PACKS) : DEFAULT_FF_PACKS;
    res.json({ packs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/api/admin/reseller/ff/packs', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { packs } = req.body as { packs: typeof DEFAULT_FF_PACKS };
    if (!Array.isArray(packs) || packs.length === 0) return res.status(400).json({ error: 'Packs invalides.' });
    await adminDb.collection('settings').doc('ff_credit_packs').set({ packs, updatedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/reseller/ff/agents — ALL agents merged with their reseller account
router.get('/api/admin/reseller/ff/agents', requireDb, requireAdminSecret, async (_req, res) => {
  try {
    // Fetch all agents
    const agentsSnap = await adminDb.collection('agents').orderBy('name').get();
    const agents = agentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    // Fetch all reseller accounts
    const accountsSnap = await adminDb.collection('agent_reseller_accounts').get();
    const accountMap = new Map<string, any>();
    accountsSnap.docs.forEach(d => accountMap.set(d.id, { id: d.id, ...d.data() }));
    // Merge: auto-defaults for agents without an account yet
    const accounts = agents.map(a => {
      const existing = accountMap.get(a.id);
      return existing ?? {
        id: a.id, agentId: a.id, agentName: a.name || '',
        enabled: true, diamondBalance: 0, totalSold: 0, totalOrders: 0,
        pending: true, // flag: not yet in Firestore
      };
    });
    res.json({ accounts });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/reseller/ff/transactions
router.get('/api/admin/reseller/ff/transactions', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { agentId, limit: lStr } = req.query as { agentId?: string; limit?: string };
    const limit = Math.min(parseInt(lStr || '100'), 200);
    let q: any = adminDb.collection('free_fire_transactions').orderBy('createdAt', 'desc').limit(limit);
    if (agentId) q = adminDb.collection('free_fire_transactions').where('agentId', '==', agentId).orderBy('createdAt', 'desc').limit(limit);
    const snap = await q.get();
    res.json({ transactions: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/reseller/ff/toggle
router.post('/api/admin/reseller/ff/toggle', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { agentId, agentName, enabled } = req.body as { agentId: string; agentName?: string; enabled: boolean };
    if (!agentId) return res.status(400).json({ error: 'agentId requis.' });
    const ref = adminDb.collection('agent_reseller_accounts').doc(agentId);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        agentId, agentName: agentName || '', enabled,
        diamondBalance: 0, totalSold: 0, totalOrders: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await ref.update({ enabled, updatedAt: FieldValue.serverTimestamp() });
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/reseller/ff/credit
router.post('/api/admin/reseller/ff/credit', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { agentId, agentName, amount, operation, note } = req.body as {
      agentId: string; agentName?: string; amount: number; operation: 'add' | 'remove'; note?: string;
    };
    if (!agentId || !amount || !operation) return res.status(400).json({ error: 'Paramètres manquants.' });
    if (Number(amount) <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    const ref = adminDb.collection('agent_reseller_accounts').doc(agentId);
    const snap = await ref.get();
    const delta = operation === 'add' ? Number(amount) : -Number(amount);
    if (!snap.exists) {
      if (operation === 'remove') return res.status(400).json({ error: 'Compte introuvable.' });
      await ref.set({
        agentId, agentName: agentName || '', enabled: true,
        diamondBalance: Number(amount), totalSold: 0, totalOrders: 0,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const current = snap.data()!.diamondBalance || 0;
      const newBal = current + delta;
      if (newBal < 0) return res.status(400).json({ error: `Solde insuffisant. Disponible : ${current} 💎` });
      await ref.update({ diamondBalance: newBal, updatedAt: FieldValue.serverTimestamp() });
    }
    await adminDb.collection('ff_credit_history').add({
      agentId, agentName: agentName || '', amount: Number(amount), operation, note: note || '',
      createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/reseller/ff/credit-packs — packs visible aux agents pour achat
router.get('/api/reseller/ff/credit-packs', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('settings').doc('ff_credit_packs').get();
    const packs = snap.exists ? (snap.data()!.packs || DEFAULT_FF_PACKS) : DEFAULT_FF_PACKS;
    res.json({ packs });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/reseller/ff/buy-pack — agent achète un pack avec son solde wallet
router.post('/api/reseller/ff/buy-pack', requireDb, async (req, res) => {
  try {
    const { agentId, packId } = req.body as { agentId: string; packId: string };
    if (!agentId || !packId) return res.status(400).json({ error: 'Paramètres manquants.' });

    // Retrieve configured packs
    const packsSnap = await adminDb.collection('settings').doc('ff_credit_packs').get();
    const packs: any[] = packsSnap.exists ? (packsSnap.data()!.packs || DEFAULT_FF_PACKS) : DEFAULT_FF_PACKS;
    const pack = packs.find((p: any) => p.id === packId);
    if (!pack) return res.status(404).json({ error: 'Pack introuvable.' });

    const agentRef = adminDb.collection('agents').doc(agentId);
    const resellerRef = adminDb.collection('agent_reseller_accounts').doc(agentId);
    let newWalletBalance = 0;
    await adminDb.runTransaction(async (txn) => {
      const [agentSnap, resellerSnap] = await Promise.all([txn.get(agentRef), txn.get(resellerRef)]);
      if (!agentSnap.exists) throw new Error('Agent introuvable.');
      const agentData = agentSnap.data()!;
      const currentBalance = Number(agentData.balance || 0);
      if (currentBalance < pack.priceUSD) {
        throw new Error(`Solde insuffisant. Disponible : ${currentBalance.toFixed(2)} — Requis : ${pack.priceUSD}`);
      }
      newWalletBalance = parseFloat((currentBalance - pack.priceUSD).toFixed(6));
      txn.update(agentRef, { balance: FieldValue.increment(-pack.priceUSD), updatedAt: FieldValue.serverTimestamp() });
      if (!resellerSnap.exists) {
        txn.set(resellerRef, {
          agentId, agentName: agentData.name || '', enabled: true,
          diamondBalance: pack.diamonds, totalSold: 0, totalOrders: 0,
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        txn.update(resellerRef, { diamondBalance: FieldValue.increment(pack.diamonds), updatedAt: FieldValue.serverTimestamp() });
      }
      txn.set(adminDb.collection('ff_credit_history').doc(), {
        agentId, agentName: agentData.name || '', amount: pack.diamonds, operation: 'add',
        note: `Achat pack ${pack.label} — ${pack.priceUSD}`,
        type: 'agent_purchase', packId, packLabel: pack.label, priceUSD: pack.priceUSD,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    res.json({ success: true, diamonds: pack.diamonds, newWalletBalance });
  } catch (e: any) {
    console.error('[reseller/ff/buy-pack]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ─── HeyQO virtual cards ──────────────────────────────────────────────────────

function finiteMoney(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function providerCardId(card: any): string {
  return String(card?.id || card?.local_id || '');
}

function providerCardStatus(card: any): string {
  return String(card?.status || card?.state || 'processing').toLowerCase();
}

function numberFrom(card: any, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = Number(card?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function publicHeyQOCard(card: any, monthlyLimit = 0): Record<string, unknown> {
  const safe = sanitizeHeyQOCard(card);
  return {
    id: String(safe.id || safe.local_id || ''),
    status: providerCardStatus(safe),
    brand: String(safe.brand || 'visa').toLowerCase(),
    currency: String(safe.currency || 'usd').toUpperCase(),
    last4: String(safe.last4 || safe.last_four || '').slice(-4) || undefined,
    maskedNumber: safe.masked_pan || safe.masked_number || undefined,
    cardholderName: safe.name_on_card || safe.cardholder_name || safe.cardholder || undefined,
    balance: numberFrom(safe, ['available_balance', 'balance', 'amount']),
    monthlyLimit: numberFrom(safe, ['monthly_limit', 'limit'], monthlyLimit),
    monthlySpent: numberFrom(safe, ['monthly_spent']),
    createdAt: safe.created_at,
    updatedAt: safe.updated_at,
  };
}

function publicHeyQOCustomer(customer: any, fallback: any = {}): Record<string, unknown> {
  const source = customer || {};
  return {
    id: source.id || fallback.heyqoCustomerId || undefined,
    localId: source.local_id ?? source.localId ?? fallback.heyqoCustomerLocalId ?? undefined,
    status: source.status || fallback.heyqoCustomerStatus || undefined,
    kycStatus: source.kyc_status || source.kycStatus || fallback.heyqoKycStatus || undefined,
  };
}

function normalizedKycStatus(customer: any): string {
  return String(customer?.kyc_status || customer?.kycStatus || customer?.status || '').toLowerCase();
}

function isApprovedHeyQOCustomer(customer: any): boolean {
  return ['approved', 'verified', 'active', 'completed'].includes(normalizedKycStatus(customer));
}

function safeDiagnostic(step: string, status: string, detail?: string): Record<string, string> {
  return {
    step,
    status,
    ...(detail ? { detail: detail.slice(0, 160) } : {}),
  };
}

function heyqoCustomerIds(client: any): string[] {
  if (client?.heyqoEnvironment && client.heyqoEnvironment !== getHeyQOEnvironment()) return [];
  return [client?.heyqoCustomerLocalId, client?.heyqoCustomerId].filter(Boolean).map(String);
}

async function cacheHeyQOCard(clientId: string, rawCard: any): Promise<void> {
  const safe = sanitizeHeyQOCard(rawCard);
  const cardId = providerCardId(safe);
  if (!cardId) return;
  await adminDb.collection('heyqo_cards').doc(cardId).set({
    clientId,
    providerCardId: cardId,
    ...safe,
    syncedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function loadOwnedHeyQOCard(clientId: string, cardId: string, client: any): Promise<any> {
  const customerIds = heyqoCustomerIds(client);
  if (customerIds.length === 0) throw new HeyQOError('Aucun profil HeyQO n’est associé à ce compte.', 404);
  const payload = await heyqoRequest(`/cards/${encodeURIComponent(cardId)}`);
  const card = extractCard(payload);
  const actualId = providerCardId(card);
  if (!actualId || actualId !== cardId) throw new HeyQOError('Carte HeyQO introuvable.', 404);

  const cardCustomerId = String(card?.customer_id || card?.customer?.id || card?.customer?.local_id || '');
  if (cardCustomerId && !customerIds.includes(cardCustomerId)) {
    throw new HeyQOError('Accès refusé à cette carte.', 403);
  }
  if (!cardCustomerId) {
    const cached = await adminDb.collection('heyqo_cards').doc(cardId).get();
    if (!cached.exists || cached.data()?.clientId !== clientId) {
      throw new HeyQOError('Impossible de confirmer le propriétaire de cette carte.', 403);
    }
  }
  await cacheHeyQOCard(clientId, card);
  return card;
}

function cardOperationId(res: express.Response, suffix: string): string {
  const operationId = String(res.locals.financialOperationId || '');
  if (operationId) return operationId;
  return createHash('sha256').update(`${suffix}:${Date.now()}:${randomBytes(8).toString('hex')}`).digest('hex');
}

function heyqoDefinitelyDidNotApply(error: unknown): boolean {
  return error instanceof HeyQOError &&
    (error.outcome === 'confirmed_rejected' || error.outcome === 'not_sent');
}

async function acquireCardIssuanceLock(clientId: string): Promise<FirebaseFirestore.DocumentReference> {
  const lockRef = adminDb.collection('heyqo_card_issuance_locks').doc(clientId);
  await adminDb.runTransaction(async (txn) => {
    const snapshot = await txn.get(lockRef);
    const status = snapshot.data()?.status;
    if (snapshot.exists && ['in_progress', 'reconciliation_required'].includes(status)) {
      throw new HeyQOError(
        status === 'reconciliation_required'
          ? 'Une émission précédente doit être vérifiée avant une nouvelle demande.'
          : 'Une demande de carte est déjà en cours.',
        409,
        undefined,
        'not_sent',
      );
    }
    txn.set(lockRef, {
      clientId,
      status: 'in_progress',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: snapshot.exists ? snapshot.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    });
  });
  return lockRef;
}

async function finishCardIssuanceLock(
  lockRef: FirebaseFirestore.DocumentReference,
  status: 'completed' | 'failed' | 'reconciliation_required',
  detail: Record<string, unknown> = {},
): Promise<void> {
  await lockRef.set({
    status,
    ...detail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function acquireHeyQOKycLock(clientId: string, operationId: string): Promise<FirebaseFirestore.DocumentReference> {
  const lockRef = adminDb.collection('heyqo_kyc_locks').doc(clientId);
  await adminDb.runTransaction(async (txn) => {
    const snapshot = await txn.get(lockRef);
    const status = snapshot.data()?.status;
    if (snapshot.exists && ['in_progress', 'reconciliation_required'].includes(status)) {
      throw new HeyQOError(
        status === 'reconciliation_required'
          ? 'Une soumission KYC précédente doit être vérifiée avant un nouvel envoi.'
          : 'Une soumission KYC est déjà en cours.',
        409,
        undefined,
        'not_sent',
      );
    }
    txn.set(lockRef, {
      clientId,
      operationId,
      status: 'in_progress',
      environment: getHeyQOEnvironment(),
      createdAt: snapshot.exists ? snapshot.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return lockRef;
}

async function finishHeyQOKycLock(
  lockRef: FirebaseFirestore.DocumentReference,
  status: 'completed' | 'failed' | 'reconciliation_required',
  detail: Record<string, unknown> = {},
): Promise<void> {
  await lockRef.set({
    status,
    ...detail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function acquireCardMovementLock(
  clientId: string,
  cardId: string,
  type: 'card_deposit' | 'card_withdrawal',
  operationId: string,
): Promise<FirebaseFirestore.DocumentReference> {
  const lockId = createHash('sha256').update(`${clientId}:${cardId}:${type}`).digest('hex');
  const lockRef = adminDb.collection('heyqo_card_movement_locks').doc(lockId);
  await adminDb.runTransaction(async (txn) => {
    const snapshot = await txn.get(lockRef);
    const status = snapshot.data()?.status;
    if (snapshot.exists && ['in_progress', 'reconciliation_required'].includes(status)) {
      throw new HeyQOError(
        status === 'reconciliation_required'
          ? 'Une opération précédente sur cette carte doit être vérifiée avant une nouvelle tentative.'
          : 'Une opération du même type est déjà en cours sur cette carte.',
        409,
        undefined,
        'not_sent',
      );
    }
    txn.set(lockRef, {
      clientId,
      cardId,
      type,
      operationId,
      status: 'in_progress',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return lockRef;
}

async function finishCardMovementLock(
  lockRef: FirebaseFirestore.DocumentReference,
  status: 'completed' | 'failed' | 'reconciliation_required',
  detail: Record<string, unknown> = {},
): Promise<void> {
  await lockRef.set({
    status,
    ...detail,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function reserveCardWalletDebit(options: {
  operationId: string;
  clientId: string;
  cardId?: string;
  amount: number;
  type: string;
  description: string;
}): Promise<{ operationRef: FirebaseFirestore.DocumentReference; transactionRef: FirebaseFirestore.DocumentReference }> {
  const operationRef = adminDb.collection('heyqo_card_operations').doc(options.operationId);
  const transactionRef = adminDb.collection('client_transactions').doc(`heyqo_${options.operationId}`);
  const clientRef = adminDb.collection('clients').doc(options.clientId);
  await adminDb.runTransaction(async (txn) => {
    const [clientSnap, operationSnap] = await Promise.all([txn.get(clientRef), txn.get(operationRef)]);
    if (operationSnap.exists) throw new Error('Cette opération de carte a déjà été reçue.');
    if (!clientSnap.exists) throw new Error('Compte client introuvable.');
    const balance = Number(clientSnap.data()?.balance || 0);
    if (balance < options.amount) throw new Error(`Solde Wallet insuffisant. Requis : $${options.amount.toFixed(2)}.`);
    txn.update(clientRef, {
      balance: FieldValue.increment(-options.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    txn.set(operationRef, {
      clientId: options.clientId,
      cardId: options.cardId || null,
      type: options.type,
      amount: options.amount,
      currency: 'USD',
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    txn.set(transactionRef, {
      clientId: options.clientId,
      type: options.type,
      amount: options.amount,
      status: 'pending',
      method: 'HeyQO',
      description: options.description,
      source: 'heyqo_card',
      operationId: options.operationId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { operationRef, transactionRef };
}

async function reserveCardIssuanceWalletDebits(options: {
  operationId: string;
  clientId: string;
  issueFee: number;
  initialDeposit: number;
  brand: string;
}): Promise<{
  issue: { operationRef: FirebaseFirestore.DocumentReference; transactionRef: FirebaseFirestore.DocumentReference };
  funding: { operationRef: FirebaseFirestore.DocumentReference; transactionRef: FirebaseFirestore.DocumentReference };
}> {
  const issueOperationRef = adminDb.collection('heyqo_card_operations').doc(options.operationId);
  const issueTransactionRef = adminDb.collection('client_transactions').doc(`heyqo_${options.operationId}`);
  const fundingId = `${options.operationId}_funding`;
  const fundingOperationRef = adminDb.collection('heyqo_card_operations').doc(fundingId);
  const fundingTransactionRef = adminDb.collection('client_transactions').doc(`heyqo_${fundingId}`);
  const clientRef = adminDb.collection('clients').doc(options.clientId);
  const total = Math.round((options.issueFee + options.initialDeposit) * 100) / 100;

  await adminDb.runTransaction(async (txn) => {
    const [clientSnap, issueSnap, fundingSnap] = await Promise.all([
      txn.get(clientRef),
      txn.get(issueOperationRef),
      txn.get(fundingOperationRef),
    ]);
    if (issueSnap.exists || fundingSnap.exists) throw new Error('Cette émission a déjà été reçue.');
    if (!clientSnap.exists) throw new Error('Compte client introuvable.');
    const balance = Number(clientSnap.data()?.balance || 0);
    if (balance < total) throw new Error(`Solde Wallet insuffisant. Requis : $${total.toFixed(2)}.`);
    txn.update(clientRef, { balance: FieldValue.increment(-total), updatedAt: FieldValue.serverTimestamp() });

    const common = {
      clientId: options.clientId,
      currency: 'USD',
      status: 'reserved',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    txn.set(issueOperationRef, { ...common, type: 'card_issue', amount: options.issueFee });
    txn.set(fundingOperationRef, { ...common, type: 'card_initial_deposit', amount: options.initialDeposit });
    txn.set(issueTransactionRef, {
      ...common,
      type: 'card_issue',
      amount: options.issueFee,
      method: 'HeyQO',
      description: `Frais de création carte ${options.brand.toUpperCase()} HeyQO`,
      source: 'heyqo_card',
      operationId: options.operationId,
    });
    txn.set(fundingTransactionRef, {
      ...common,
      type: 'card_initial_deposit',
      amount: options.initialDeposit,
      method: 'HeyQO',
      description: 'Dépôt initial sur la carte HeyQO',
      source: 'heyqo_card',
      operationId: fundingId,
    });
  });

  return {
    issue: { operationRef: issueOperationRef, transactionRef: issueTransactionRef },
    funding: { operationRef: fundingOperationRef, transactionRef: fundingTransactionRef },
  };
}

async function settleCardWalletDebit(
  operationRef: FirebaseFirestore.DocumentReference,
  transactionRef: FirebaseFirestore.DocumentReference,
  providerData: Record<string, unknown>,
): Promise<void> {
  const batch = adminDb.batch();
  batch.update(operationRef, {
    status: 'completed',
    ...providerData,
    completedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(transactionRef, {
    status: 'completed',
    ...providerData,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

async function refundCardWalletDebit(
  operationRef: FirebaseFirestore.DocumentReference,
  transactionRef: FirebaseFirestore.DocumentReference,
  clientId: string,
  amount: number,
  errorMessage: string,
): Promise<void> {
  const clientRef = adminDb.collection('clients').doc(clientId);
  await adminDb.runTransaction(async (txn) => {
    const operationSnap = await txn.get(operationRef);
    if (!operationSnap.exists || operationSnap.data()?.status !== 'reserved') return;
    txn.update(clientRef, {
      balance: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    txn.update(operationRef, {
      status: 'refunded',
      error: errorMessage.slice(0, 240),
      refundedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    txn.update(transactionRef, {
      status: 'rejected',
      rejectionReason: errorMessage.slice(0, 240),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function markCardOperationForReconciliation(
  operationRef: FirebaseFirestore.DocumentReference,
  transactionRef: FirebaseFirestore.DocumentReference,
  errorMessage: string,
): Promise<void> {
  const batch = adminDb.batch();
  batch.update(operationRef, {
    status: 'reconciliation_required',
    error: errorMessage.slice(0, 240),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(transactionRef, {
    status: 'pending',
    description: 'Opération HeyQO en vérification',
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

async function listLocalCardActivity(clientId: string): Promise<Record<string, unknown>[]> {
  const snapshot = await adminDb.collection('heyqo_card_operations')
    .where('clientId', '==', clientId)
    .limit(100)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const timestamp = data.completedAt || data.createdAt;
      return {
        id: doc.id,
        type: data.type || 'card_activity',
        amount: Number(data.amount || 0),
        currency: data.currency || 'USD',
        status: data.status || 'pending',
        description:
          data.type === 'card_deposit' ? 'Recharge de la carte' :
          data.type === 'card_withdrawal' ? 'Retrait vers le Wallet' :
          data.type === 'card_issue' ? 'Création de la carte' :
          'Activité de carte',
        createdAt: timestamp?.toDate ? timestamp.toDate().toISOString() : undefined,
      };
    })
    .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, 20);
}

const HEYQO_KYC_ENUMS = {
  gender: new Set(['male', 'female', 'other']),
  documentType: new Set(['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE']),
  employmentStatus: new Set(['employed', 'self_employed', 'student', 'retired', 'homemaker', 'unemployed']),
  primaryPurpose: new Set(['personal_or_living_expenses', 'payments_to_friends_or_family_abroad']),
  sourceOfFunds: new Set(['salary', 'savings', 'company_funds']),
  expectedMonthlyPay: new Set(['0_4999', '5000_9999']),
};

function cleanKycText(value: unknown, maxLength: number): string {
  return String(value || '').trim().slice(0, maxLength);
}

function validateKycImage(value: unknown, label: string, required = true): string | undefined {
  const encoded = typeof value === 'string' ? value.replace(/^data:image\/(?:jpeg|png);base64,/i, '') : '';
  if (!encoded) {
    if (required) throw new HeyQOError(`${label} est requis.`, 400, undefined, 'not_sent');
    return undefined;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new HeyQOError(`${label} est invalide.`, 400, undefined, 'not_sent');
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) {
    throw new HeyQOError(`${label} doit peser au maximum 4 Mo.`, 400, undefined, 'not_sent');
  }
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isJpeg && !isPng) throw new HeyQOError(`${label} doit être une image JPG ou PNG.`, 400, undefined, 'not_sent');
  return encoded;
}

router.post('/api/client/cards/customer', requireDb, async (req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const clientRef = adminDb.collection('clients').doc(clientId);
  const client = res.locals.clientRecord.data() || {};
  const operationId = cardOperationId(res, 'customer_kyc');
  const operationRef = adminDb.collection('heyqo_kyc_operations').doc(operationId);
  let lockRef: FirebaseFirestore.DocumentReference | null = null;
  let providerMutationStarted = false;
  if (!isHeyQOConfigured()) return res.status(503).json({ error: 'Le Sandbox HeyQO n’est pas configuré.' });
  try {
    const kyc = req.body?.kyc || {};
    const dateOfBirth = cleanKycText(kyc.dateOfBirth, 10);
    const gender = cleanKycText(kyc.gender, 16);
    const documentType = cleanKycText(kyc.documentType, 32).toUpperCase();
    const employmentStatus = cleanKycText(kyc.employmentStatus, 32);
    const primaryPurpose = cleanKycText(kyc.primaryPurpose, 80);
    const sourceOfFunds = cleanKycText(kyc.sourceOfFunds, 40);
    const expectedMonthlyPay = cleanKycText(kyc.expectedMonthlyPay, 32);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new HeyQOError('La date de naissance est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.gender.has(gender)) throw new HeyQOError('Le genre sélectionné est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.documentType.has(documentType)) throw new HeyQOError('Le type de document est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.employmentStatus.has(employmentStatus)) throw new HeyQOError('Le statut professionnel est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.primaryPurpose.has(primaryPurpose)) throw new HeyQOError('Le motif principal est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.sourceOfFunds.has(sourceOfFunds)) throw new HeyQOError('La source des fonds est invalide.', 400, undefined, 'not_sent');
    if (!HEYQO_KYC_ENUMS.expectedMonthlyPay.has(expectedMonthlyPay)) throw new HeyQOError('La tranche mensuelle est invalide.', 400, undefined, 'not_sent');
    if (!client.email || !client.phone || !client.name) throw new HeyQOError('Le nom, l’adresse e-mail et le téléphone du profil client sont requis.', 400, undefined, 'not_sent');
    if (!kyc.consent) throw new HeyQOError('Votre consentement est requis pour transmettre le dossier KYC à HeyQO.', 400, undefined, 'not_sent');

    const nameParts = String(client.name).trim().split(/\s+/);
    const documentFront = validateKycImage(kyc.documentFrontBase64, 'Le recto de la pièce');
    const documentBack = validateKycImage(kyc.documentBackBase64, 'Le verso de la pièce', false);
    const proofOfAddress = validateKycImage(kyc.proofOfAddressBase64, 'Le justificatif d’adresse');
    const customerBody = {
      first_name: nameParts.shift() || 'Client',
      last_name: nameParts.join(' ') || 'Solutionpam',
      email: String(client.email).trim(),
      phone: String(client.phone).trim(),
      country_code: cleanKycText(kyc.addressCountry || 'HT', 3).toUpperCase(),
      date_of_birth: dateOfBirth,
      gender,
      document_type: documentType,
      document_number: cleanKycText(kyc.documentNumber, 80),
      ...(cleanKycText(kyc.taxIdNumber, 80) && { tax_id_number: cleanKycText(kyc.taxIdNumber, 80) }),
      document_front_base64: documentFront,
      ...(documentBack && { document_back_base64: documentBack }),
      address_street: cleanKycText(kyc.addressStreet, 160),
      address_city: cleanKycText(kyc.addressCity, 80),
      address_state: cleanKycText(kyc.addressState, 80),
      address_postal_code: cleanKycText(kyc.addressPostalCode, 24),
      address_country: cleanKycText(kyc.addressCountry || 'HT', 3).toUpperCase(),
      proof_of_address_base64: proofOfAddress,
      pof_employment_status: employmentStatus,
      pof_occupation: cleanKycText(kyc.occupation, 40),
      pof_primary_purpose: primaryPurpose,
      pof_source_of_funds: sourceOfFunds,
      pof_expected_monthly_pay: expectedMonthlyPay,
      external_ref: clientId,
    };
    const missing = Object.entries(customerBody)
      .filter(([key, value]) => !String(value || '').trim() && !['tax_id_number', 'document_back_base64'].includes(key))
      .map(([key]) => key);
    if (missing.length) throw new HeyQOError('Complétez toutes les informations KYC obligatoires.', 400, undefined, 'not_sent');

    const existingId = heyqoCustomerIds(client)[0];
    if (client.heyqoKycReconciliationRequired) {
      throw new HeyQOError('Une soumission KYC précédente doit être vérifiée avant un nouvel envoi.', 409, undefined, 'not_sent');
    }
    lockRef = await acquireHeyQOKycLock(clientId, operationId);
    await operationRef.create({
      clientId,
      type: existingId ? 'customer_kyc_update' : 'customer_kyc_create',
      status: 'in_progress',
      environment: getHeyQOEnvironment(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    providerMutationStarted = true;
    const customerPayload = await heyqoRequest(existingId ? `/customers/${encodeURIComponent(existingId)}` : '/customers', {
      method: existingId ? 'PATCH' : 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify(customerBody),
    });
    const customer = extractCustomer(customerPayload);
    const customerId = String(customer?.id || client.heyqoCustomerId || '');
    const localId = String(customer?.local_id ?? customer?.localId ?? client.heyqoCustomerLocalId ?? customerId);
    if (!localId) throw new HeyQOError('HeyQO n’a pas renvoyé de local_id client.', 502);
    const status = String(customer?.status || 'processing').toLowerCase();
    const kycStatus = String(customer?.kyc_status || customer?.kycStatus || status || 'pending').toLowerCase();
    await clientRef.update({
      heyqoCustomerId: customerId || localId,
      heyqoCustomerLocalId: localId,
      heyqoCustomerStatus: status,
      heyqoKycStatus: kycStatus,
      heyqoEnvironment: getHeyQOEnvironment(),
      heyqoKycReconciliationRequired: false,
      heyqoKycSubmittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await operationRef.update({
      status: 'completed',
      customerId: customerId || localId,
      customerLocalId: localId,
      providerStatus: kycStatus,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await finishHeyQOKycLock(lockRef, 'completed', {
      operationId,
      customerLocalId: localId,
      providerStatus: kycStatus,
    });
    res.status(existingId ? 200 : 201).json({
      success: true,
      customer: publicHeyQOCustomer(customer, { heyqoCustomerId: customerId, heyqoCustomerLocalId: localId }),
      diagnostics: [
        safeDiagnostic('authentication', 'success', `${getHeyQOEnvironment()} connecté`),
        safeDiagnostic('customer_kyc', kycStatus, `customer local_id ${localId}`),
      ],
    });
  } catch (error: any) {
    if (providerMutationStarted) {
      const uncertain = !heyqoDefinitelyDidNotApply(error);
      await operationRef.set({
        status: uncertain ? 'reconciliation_required' : 'failed',
        error: String(error?.message || 'Erreur HeyQO').slice(0, 240),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
      if (uncertain) {
        await clientRef.update({
          heyqoKycReconciliationRequired: true,
          updatedAt: FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      if (lockRef) {
        await finishHeyQOKycLock(
          lockRef,
          uncertain ? 'reconciliation_required' : 'failed',
          { operationId, error: String(error?.message || 'Erreur HeyQO').slice(0, 240) },
        ).catch(() => {});
      }
    } else if (lockRef) {
      await finishHeyQOKycLock(lockRef, 'failed', {
        operationId,
        error: String(error?.message || 'Erreur avant appel HeyQO').slice(0, 240),
      }).catch(() => {});
    }
    console.error('[HeyQO customer KYC]', error?.message || error);
    res.status(error instanceof HeyQOError ? error.status : 502).json({ error: error?.message || 'Impossible de soumettre le dossier KYC.' });
  }
});

router.get('/api/client/cards', requireDb, async (_req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const client = res.locals.clientRecord.data() || {};
  if (!isHeyQOConfigured()) {
    return res.json({
      configured: false,
      environment: getHeyQOEnvironment(),
      webhookConfigured: Boolean(process.env.HEYQO_WEBHOOK_SECRET),
      customer: null,
      cards: [],
      cardTransactions: [],
      diagnostics: [safeDiagnostic('configuration', 'error', 'Identifiants HeyQO absents')],
    });
  }
  try {
    const customerIds = heyqoCustomerIds(client);
    if (customerIds.length === 0) {
      return res.json({
        configured: true,
        environment: getHeyQOEnvironment(),
        webhookConfigured: Boolean(process.env.HEYQO_WEBHOOK_SECRET),
        customer: null,
        cards: [],
        cardTransactions: [],
        diagnostics: [
          safeDiagnostic('authentication', 'success', `${getHeyQOEnvironment()} connecté`),
          safeDiagnostic('customer_kyc', 'not_started'),
        ],
      });
    }
    const customerId = customerIds[0];
    const [customerPayload, payload, settingsSnap, cardTransactions] = await Promise.all([
      heyqoRequest(`/customers/${encodeURIComponent(customerId)}`),
      heyqoRequest(`/cards?customer_id=${encodeURIComponent(customerId)}`),
      adminDb.collection('settings').doc('global').get(),
      listLocalCardActivity(clientId),
    ]);
    const customer = extractCustomer(customerPayload);
    const currentStatus = String(customer?.status || client.heyqoCustomerStatus || 'processing').toLowerCase();
    const currentKycStatus = String(customer?.kyc_status || customer?.kycStatus || client.heyqoKycStatus || currentStatus).toLowerCase();
    await adminDb.collection('clients').doc(clientId).update({
      heyqoCustomerStatus: currentStatus,
      heyqoKycStatus: currentKycStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const monthlyLimit = Number(settingsSnap.data()?.heyqoMonthlyLimitUSD || 0);
    const rawCards = extractCardList(payload);
    await Promise.all(rawCards.map((card) => cacheHeyQOCard(clientId, card)));
    res.json({
      configured: true,
      environment: getHeyQOEnvironment(),
      webhookConfigured: Boolean(process.env.HEYQO_WEBHOOK_SECRET),
      customer: publicHeyQOCustomer(customer, client),
      cards: rawCards.map((card) => publicHeyQOCard(card, monthlyLimit)),
      cardTransactions,
      diagnostics: [
        safeDiagnostic('authentication', 'success', `${getHeyQOEnvironment()} connecté`),
        safeDiagnostic('customer_kyc', currentKycStatus, `customer local_id ${customerId}`),
        safeDiagnostic('cards', rawCards.length ? 'success' : 'empty', `${rawCards.length} carte(s)`),
      ],
    });
  } catch (error: any) {
    console.error('[HeyQO cards list]', error?.message || error);
    const cached = await adminDb.collection('heyqo_cards').where('clientId', '==', clientId).limit(10).get().catch(() => null);
    if (cached && !cached.empty) {
      return res.json({
        configured: true,
        environment: getHeyQOEnvironment(),
        webhookConfigured: Boolean(process.env.HEYQO_WEBHOOK_SECRET),
        customer: {
          id: client.heyqoCustomerId || undefined,
          localId: client.heyqoCustomerLocalId || undefined,
          status: client.heyqoCustomerStatus || undefined,
          kycStatus: client.heyqoKycStatus || undefined,
        },
        cards: cached.docs.map((doc) => publicHeyQOCard(doc.data())),
        cardTransactions: await listLocalCardActivity(clientId).catch(() => []),
        stale: true,
        diagnostics: [safeDiagnostic('sync', 'stale', 'Données locales affichées')],
      });
    }
    res.status(error instanceof HeyQOError ? error.status : 502).json({ error: error?.message || 'Impossible de charger les cartes HeyQO.' });
  }
});

router.post('/api/client/cards', requireDb, async (req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const clientRef = adminDb.collection('clients').doc(clientId);
  const initialClient = res.locals.clientRecord.data() || {};
  const brand = String(req.body?.brand || 'visa').toLowerCase();
  if (!['visa', 'mastercard'].includes(brand)) return res.status(400).json({ error: 'Marque de carte invalide.' });
  if (!isHeyQOConfigured()) return res.status(503).json({ error: 'Le service Cartes est en attente de configuration HeyQO.' });
  let customerIds = heyqoCustomerIds(initialClient);
  if (customerIds.length === 0) return res.status(409).json({ error: 'Soumettez d’abord votre dossier KYC HeyQO.' });
  let issuanceLockRef: FirebaseFirestore.DocumentReference | null = null;
  try {
    issuanceLockRef = await acquireCardIssuanceLock(clientId);
    const customerPayload = await heyqoRequest(`/customers/${encodeURIComponent(customerIds[0])}`);
    const currentCustomer = extractCustomer(customerPayload);
    await clientRef.update({
      heyqoCustomerStatus: currentCustomer?.status || initialClient.heyqoCustomerStatus || 'processing',
      heyqoKycStatus: currentCustomer?.kyc_status || currentCustomer?.kycStatus || initialClient.heyqoKycStatus || 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (!isApprovedHeyQOCustomer(currentCustomer)) {
      await finishCardIssuanceLock(issuanceLockRef, 'failed', { kycStatus: normalizedKycStatus(currentCustomer) || 'pending' });
      return res.status(409).json({ error: `Le dossier KYC doit être approuvé avant l’émission (statut : ${normalizedKycStatus(currentCustomer) || 'pending'}).` });
    }

    const listPayload = await heyqoRequest(`/cards?customer_id=${encodeURIComponent(customerIds[0])}`);
    const existing = extractCardList(listPayload).find((card) => providerCardStatus(card) !== 'terminated');
    if (existing) {
      await cacheHeyQOCard(clientId, existing);
      await finishCardIssuanceLock(issuanceLockRef, 'completed', { cardId: providerCardId(existing) });
      return res.json({ success: true, card: publicHeyQOCard(existing), existing: true });
    }

    const settingsSnap = await adminDb.collection('settings').doc('global').get();
    const settings = settingsSnap.data() || {};
    const issueFee = Math.max(0, Number(settings.heyqoCardFeeUSD ?? 5));
    const initialDeposit = Math.max(1, Number(settings.heyqoCardInitialDepositUSD ?? 1));
    const operationId = cardOperationId(res, 'card_issue');
    const reservations = await reserveCardIssuanceWalletDebits({
      operationId,
      clientId,
      issueFee,
      initialDeposit,
      brand,
    });

    try {
      const issuePayload = await heyqoRequest('/cards', {
        method: 'POST',
        headers: { 'Idempotency-Key': operationId },
        body: JSON.stringify({
          customer_id: customerIds[0],
          currency: 'usd',
          brand,
          amount: initialDeposit,
          label: 'Solutionpam virtual card',
        }),
      });
      const card = extractCard(issuePayload);
      const cardId = providerCardId(card);
      if (!cardId) {
        await markCardOperationForReconciliation(reservations.issue.operationRef, reservations.issue.transactionRef, 'Carte créée sans identifiant exploitable.');
        await markCardOperationForReconciliation(
          reservations.funding.operationRef,
          reservations.funding.transactionRef,
          'Financement initial inclus dans une émission sans identifiant exploitable.',
        );
        await finishCardIssuanceLock(issuanceLockRef, 'reconciliation_required', { operationId });
        return res.status(202).json({ success: true, processing: true, card: publicHeyQOCard(card) });
      }
      await cacheHeyQOCard(clientId, card);
      await settleCardWalletDebit(reservations.issue.operationRef, reservations.issue.transactionRef, {
        cardId,
        providerStatus: providerCardStatus(card),
      });
      await settleCardWalletDebit(reservations.funding.operationRef, reservations.funding.transactionRef, {
        cardId,
        providerStatus: providerCardStatus(card),
        fundingIncludedInIssuance: true,
      });
      await finishCardIssuanceLock(issuanceLockRef, 'completed', { operationId, cardId, fundingStatus: 'completed' });
      return res.status(providerCardStatus(card) === 'processing' ? 202 : 201).json({
        success: true,
        processing: providerCardStatus(card) === 'processing',
        fundingStatus: 'completed',
        card: publicHeyQOCard(card, Number(settings.heyqoMonthlyLimitUSD || 0)),
      });
    } catch (error: any) {
      if (heyqoDefinitelyDidNotApply(error)) {
        await Promise.all([
          refundCardWalletDebit(reservations.issue.operationRef, reservations.issue.transactionRef, clientId, issueFee, error.message),
          refundCardWalletDebit(reservations.funding.operationRef, reservations.funding.transactionRef, clientId, initialDeposit, error.message),
        ]);
        await finishCardIssuanceLock(issuanceLockRef, 'failed', { operationId });
      } else {
        await Promise.all([
          markCardOperationForReconciliation(reservations.issue.operationRef, reservations.issue.transactionRef, error?.message || 'Réponse HeyQO incertaine.'),
          markCardOperationForReconciliation(
            reservations.funding.operationRef,
            reservations.funding.transactionRef,
            'Financement initial inclus dans une émission HeyQO incertaine.',
          ),
        ]);
        await finishCardIssuanceLock(issuanceLockRef, 'reconciliation_required', { operationId });
      }
      throw error;
    }
  } catch (error: any) {
    if (issuanceLockRef) {
      const lock = await issuanceLockRef.get().catch(() => null);
      if (lock?.data()?.status === 'in_progress') {
        await finishCardIssuanceLock(
          issuanceLockRef,
          heyqoDefinitelyDidNotApply(error) ? 'failed' : 'reconciliation_required',
          { error: String(error?.message || 'Erreur HeyQO').slice(0, 240) },
        ).catch(() => {});
      }
    }
    console.error('[HeyQO card issue]', error?.message || error);
    res.status(error instanceof HeyQOError ? error.status : 500).json({ error: error?.message || 'Impossible de créer la carte.' });
  }
});

router.post('/api/client/cards/:cardId/secure-view', requireDb, async (req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const client = res.locals.clientRecord.data() || {};
  try {
    await loadOwnedHeyQOCard(clientId, req.params.cardId, client);
    const payload = await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}/secure-view`, {
      method: 'POST',
      body: JSON.stringify({
        layout: 'free',
        background_color: '#07111F',
        text_color: '#FFFFFF',
        show_branding: false,
        brand_label: 'Solutionpam',
        fields_order: 'pan,expiry,cvv,cardholder,brand',
      }),
    });
    const data = unwrapHeyQO<any>(payload);
    const url = data?.url || data?.secure_view_url || data?.iframe_url;
    if (typeof url !== 'string' || !url.startsWith('https://heyqo.cash/')) {
      throw new HeyQOError('HeyQO n’a pas renvoyé de vue sécurisée valide.', 502);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ url, expiresAt: data?.expires_at || new Date(Date.now() + 90_000).toISOString() });
  } catch (error: any) {
    res.status(error instanceof HeyQOError ? error.status : 502).json({ error: error?.message || 'Affichage sécurisé indisponible.' });
  }
});

router.post('/api/client/cards/:cardId/deposit', requireDb, async (req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const client = res.locals.clientRecord.data() || {};
  const amount = finiteMoney(req.body?.amount);
  if (!amount) return res.status(400).json({ error: 'Montant de recharge invalide.' });
  const operationId = cardOperationId(res, 'card_deposit');
  let reservation: Awaited<ReturnType<typeof reserveCardWalletDebit>> | null = null;
  let movementLockRef: FirebaseFirestore.DocumentReference | null = null;
  let providerMutationStarted = false;
  try {
    await loadOwnedHeyQOCard(clientId, req.params.cardId, client);
    movementLockRef = await acquireCardMovementLock(clientId, req.params.cardId, 'card_deposit', operationId);
    reservation = await reserveCardWalletDebit({
      operationId,
      clientId,
      cardId: req.params.cardId,
      amount,
      type: 'card_deposit',
      description: 'Recharge carte HeyQO depuis le Wallet',
    });
    providerMutationStarted = true;
    const payload = await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}/deposit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify({ amount, currency: 'usd' }),
    });
    await settleCardWalletDebit(reservation.operationRef, reservation.transactionRef, {
      cardId: req.params.cardId,
      providerReference: unwrapHeyQO<any>(payload)?.id || null,
    });
    await finishCardMovementLock(movementLockRef, 'completed', {
      providerReference: unwrapHeyQO<any>(payload)?.id || null,
    });
    try {
      const card = extractCard(await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}`));
      await cacheHeyQOCard(clientId, card);
      return res.json({ success: true, card: publicHeyQOCard(card) });
    } catch (refreshError: any) {
      console.warn('[HeyQO deposit refresh]', refreshError?.message || refreshError);
      return res.json({ success: true, stale: true });
    }
  } catch (error: any) {
    if (reservation) {
      if (heyqoDefinitelyDidNotApply(error)) {
        await refundCardWalletDebit(reservation.operationRef, reservation.transactionRef, clientId, amount, error.message);
        if (movementLockRef) await finishCardMovementLock(movementLockRef, 'failed', { error: error.message }).catch(() => {});
      } else {
        await markCardOperationForReconciliation(reservation.operationRef, reservation.transactionRef, error?.message || 'Réponse HeyQO incertaine.');
        if (movementLockRef) await finishCardMovementLock(movementLockRef, 'reconciliation_required', {
          operationId,
          error: String(error?.message || 'Réponse HeyQO incertaine.').slice(0, 240),
        }).catch(() => {});
      }
    } else if (movementLockRef) {
      await finishCardMovementLock(
        movementLockRef,
        providerMutationStarted ? 'reconciliation_required' : 'failed',
        { error: String(error?.message || 'Erreur avant appel HeyQO').slice(0, 240) },
      ).catch(() => {});
    }
    res.status(error instanceof HeyQOError ? error.status : 500).json({ error: error?.message || 'Recharge impossible.' });
  }
});

router.post('/api/client/cards/:cardId/withdraw', requireDb, async (req, res) => {
  const clientId = res.locals.clientSession.clientId as string;
  const client = res.locals.clientRecord.data() || {};
  const amount = finiteMoney(req.body?.amount);
  if (!amount) return res.status(400).json({ error: 'Montant de retrait invalide.' });
  const operationId = cardOperationId(res, 'card_withdrawal');
  const operationRef = adminDb.collection('heyqo_card_operations').doc(operationId);
  let movementLockRef: FirebaseFirestore.DocumentReference | null = null;
  let providerMutationStarted = false;
  try {
    const card = await loadOwnedHeyQOCard(clientId, req.params.cardId, client);
    if (numberFrom(card, ['available_balance', 'balance', 'amount']) < amount) {
      return res.status(400).json({ error: 'Solde de carte insuffisant.' });
    }
    movementLockRef = await acquireCardMovementLock(clientId, req.params.cardId, 'card_withdrawal', operationId);
    await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(operationRef);
      if (snap.exists) throw new Error('Cette opération de carte a déjà été reçue.');
      txn.set(operationRef, {
        clientId, cardId: req.params.cardId, type: 'card_withdrawal', amount,
        currency: 'USD', status: 'processing',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });
    providerMutationStarted = true;
    const payload = await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}/withdraw`, {
      method: 'POST',
      headers: { 'Idempotency-Key': operationId },
      body: JSON.stringify({ amount, currency: 'usd' }),
    });
    const clientRef = adminDb.collection('clients').doc(clientId);
    const transactionRef = adminDb.collection('client_transactions').doc(`heyqo_${operationId}`);
    await adminDb.runTransaction(async (txn) => {
      const operationSnap = await txn.get(operationRef);
      if (operationSnap.data()?.status !== 'processing') throw new Error('État d’opération invalide.');
      txn.update(clientRef, { balance: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() });
      txn.update(operationRef, {
        status: 'completed',
        providerReference: unwrapHeyQO<any>(payload)?.id || null,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      txn.set(transactionRef, {
        clientId, type: 'card_withdrawal', amount, status: 'completed',
        method: 'HeyQO', source: 'heyqo_card', operationId,
        description: 'Retrait de la carte vers le Wallet',
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await finishCardMovementLock(movementLockRef, 'completed', {
      providerReference: unwrapHeyQO<any>(payload)?.id || null,
    });
    try {
      const refreshed = extractCard(await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}`));
      await cacheHeyQOCard(clientId, refreshed);
      return res.json({ success: true, card: publicHeyQOCard(refreshed) });
    } catch (refreshError: any) {
      console.warn('[HeyQO withdrawal refresh]', refreshError?.message || refreshError);
      return res.json({ success: true, stale: true });
    }
  } catch (error: any) {
    const operation = await operationRef.get().catch(() => null);
    if (operation?.exists && operation.data()?.status === 'processing') {
      const reconciliationRequired = providerMutationStarted && !heyqoDefinitelyDidNotApply(error);
      await operationRef.update({
        status: reconciliationRequired ? 'reconciliation_required' : 'failed',
        error: String(error?.message || 'Erreur HeyQO').slice(0, 240),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      if (movementLockRef) {
        await finishCardMovementLock(
          movementLockRef,
          reconciliationRequired ? 'reconciliation_required' : 'failed',
          { operationId, error: String(error?.message || 'Erreur HeyQO').slice(0, 240) },
        ).catch(() => {});
      }
    } else if (movementLockRef) {
      await finishCardMovementLock(
        movementLockRef,
        providerMutationStarted ? 'reconciliation_required' : 'failed',
        { operationId, error: String(error?.message || 'Erreur HeyQO').slice(0, 240) },
      ).catch(() => {});
    }
    res.status(error instanceof HeyQOError ? error.status : 500).json({ error: error?.message || 'Retrait impossible.' });
  }
});

async function changeCardState(req: express.Request, res: express.Response, action: 'freeze' | 'unfreeze' | 'terminate') {
  const clientId = res.locals.clientSession.clientId as string;
  const client = res.locals.clientRecord.data() || {};
  try {
    await loadOwnedHeyQOCard(clientId, req.params.cardId, client);
    await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}/${action}`, { method: 'PUT' });
    const card = extractCard(await heyqoRequest(`/cards/${encodeURIComponent(req.params.cardId)}`));
    await cacheHeyQOCard(clientId, card);
    res.json({ success: true, card: publicHeyQOCard(card) });
  } catch (error: any) {
    res.status(error instanceof HeyQOError ? error.status : 502).json({ error: error?.message || 'Action de carte impossible.' });
  }
}

router.post('/api/client/cards/:cardId/freeze', requireDb, (req, res) => changeCardState(req, res, 'freeze'));
router.post('/api/client/cards/:cardId/unfreeze', requireDb, (req, res) => changeCardState(req, res, 'unfreeze'));
router.post('/api/client/cards/:cardId/terminate', requireDb, (req, res) => changeCardState(req, res, 'terminate'));

router.post('/api/webhooks/heyqo', requireDb, async (req, res) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const secret = process.env.HEYQO_WEBHOOK_SECRET;
  const received = String(req.get('X-HeyQo-Signature') || req.get('X-HeyQO-Signature') || '').replace(/^sha256=/i, '');
  if (!secret || !rawBody || !received) return res.status(401).json({ error: 'Signature HeyQO manquante.' });
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = /^[a-f0-9]{64}$/i.test(received) ? Buffer.from(received, 'hex') : Buffer.alloc(0);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Signature HeyQO invalide.' });
  }

  const event = req.body || {};
  const eventId = String(event.id || event.event_id || webhookDigest(rawBody));
  const eventRef = adminDb.collection('heyqo_webhook_events').doc(eventId);
  try {
    const claimed = await adminDb.runTransaction(async (txn) => {
      const snap = await txn.get(eventRef);
      if (snap.exists) return false;
      txn.create(eventRef, {
        type: event.type || event.event || 'unknown',
        status: 'received',
        receivedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!claimed) return res.json({ received: true, duplicate: true });

    const cardId = String(
      event.data?.card_id ||
      event.data?.card?.id ||
      event.card_id ||
      event.card?.id ||
      '',
    );
    if (cardId) {
      const cached = await adminDb.collection('heyqo_cards').doc(cardId).get();
      if (cached.exists) {
        const card = extractCard(await heyqoRequest(`/cards/${encodeURIComponent(cardId)}`));
        await cacheHeyQOCard(String(cached.data()?.clientId || ''), card);
      }
    }
    await eventRef.update({ status: 'processed', processedAt: FieldValue.serverTimestamp() });
    res.json({ received: true });
  } catch (error: any) {
    await eventRef.set({
      status: 'failed',
      error: String(error?.message || error).slice(0, 240),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});
    console.error('[HeyQO webhook]', error?.message || error);
    res.status(500).json({ error: 'Traitement du webhook HeyQO impossible.' });
  }
});

// ── Catch-all: unmatched /api/* → clean JSON 404 ─────────────────────────────
router.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

export { adminDb };
export default router;
