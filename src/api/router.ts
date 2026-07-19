import express from 'express';
import nodemailer from 'nodemailer';
import { createHash, createHmac, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging as getAdminMessaging } from 'firebase-admin/messaging';
import {
  emailDepositSubmitted, emailDepositApproved, emailDepositRejected,
  emailWithdrawalSubmitted, emailWithdrawalApproved, emailWithdrawalRejected,
  emailWithdrawalOtp, emailAgentWithdrawalConfirmed, emailAffiliateCommission,
  emailPurchase, emailAffiliateWithdrawalSubmitted,
  emailAffiliateWithdrawalApproved, emailAffiliateWithdrawalRejected,
  emailFormationPurchase,
  emailAgentNewRequest, emailAgentProcessed,
  ADMIN_EMAIL,
} from '../lib/email.ts';

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
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  transporter.sendMail({
    from: `"Rena System" <${process.env.SMTP_USER}>`,
    to: process.env.SMTP_USER,
    subject,
    text,
  }).catch((err: any) => console.error('[Email] Erreur envoi:', err.message));
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

// ─── Router ───────────────────────────────────────────────────────────────────

const router = express.Router();

// ── SSE: active client connections ────────────────────────────────────────────
const clientSseConnections = new Map<string, Set<express.Response>>();

function pushClientEvent(clientId: string, event: string, data: object): void {
  const connections = clientSseConnections.get(clientId);
  if (!connections || connections.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of [...connections]) {
    try { res.write(payload); } catch { connections.delete(res); }
  }
}

// ── SSE: Multi-role real-time connections (affiliate, agent, teacher, admin) ──
type SseRole = 'affiliate' | 'agent' | 'teacher' | 'admin';
const roleSseConnections: Record<SseRole, Map<string, Set<express.Response>>> = {
  affiliate: new Map(),
  agent:     new Map(),
  teacher:   new Map(),
  admin:     new Map(),
};

function pushRoleEvent(role: SseRole, userId: string, event: string, data: object): void {
  const map = roleSseConnections[role];
  const connections = map.get(userId);
  if (!connections || connections.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of [...connections]) {
    try { res.write(payload); } catch { connections.delete(res); }
  }
}

function pushAllAdminsEvent(event: string, data: object): void {
  const map = roleSseConnections['admin'];
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const conns of map.values()) {
    for (const res of [...conns]) {
      try { res.write(payload); } catch { conns.delete(res); }
    }
  }
}

function makeSseHandler(role: SseRole, paramName: string) {
  return (req: express.Request, res: express.Response) => {
    const userId = req.params[paramName];
    if (!userId) { res.status(400).end(); return; }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const map = roleSseConnections[role];
    if (!map.has(userId)) map.set(userId, new Set());
    const conns = map.get(userId)!;
    conns.add(res);
    res.write(': connected\n\n');
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
    }, 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      conns.delete(res);
      if (conns.size === 0) map.delete(userId);
    });
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
router.get('/api/teacher/events/:teacherId',     makeSseHandler('teacher',   'teacherId'));
router.get('/api/admin/events/:adminId',         makeSseHandler('admin',     'adminId'));

// ── Client: SSE event stream (withdrawal confirmations, etc.) ─────────────────
router.get('/api/client/events/:clientId', (req, res) => {
  const { clientId } = req.params;
  if (!clientId) { res.status(400).end(); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  if (!clientSseConnections.has(clientId)) clientSseConnections.set(clientId, new Set());
  const conns = clientSseConnections.get(clientId)!;
  conns.add(res);

  // Initial heartbeat
  res.write(': connected\n\n');

  // Keep-alive ping every 25 s
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    conns.delete(res);
    if (conns.size === 0) clientSseConnections.delete(clientId);
  });
});

// ── Health ───────────────────────────────────────────────────────────────────
router.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Debug (diagnostic Vercel — protégé par x-admin-secret) ───────────────────
router.get('/api/debug', async (req, res) => {
  if (req.headers['x-admin-secret'] !== 'rena-admin-2024')
    return res.status(403).json({ error: 'Non autorisé.' });

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
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials missing. Skipping email notification.');
      return res.status(200).json({ success: true, warning: 'SMTP credentials missing' });
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Rena System" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `Nouvelle demande d'inscription affilié : ${name}`,
      text: `Nouvelle demande d'inscription reçue !\n\nNom: ${name}\nEmail: ${email}\nTéléphone: ${phone || 'Non fourni'}\nMessage: ${message || 'Aucun message'}\nDate: ${date}\n\nConnectez-vous au tableau de bord administrateur pour approuver ou rejeter cette demande.`,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ── Transactions ─────────────────────────────────────────────────────────────
router.get('/api/admin/transactions', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('client_transactions').orderBy('createdAt', 'desc').limit(500).get();
    res.json({ transactions: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[GET transactions]', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/client/transactions/:clientId', requireDb, async (req, res) => {
  try {
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

router.delete('/api/client/transactions/:clientId', requireDb, async (req, res) => {
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
router.get('/api/admin/notifications', requireDb, async (_req, res) => {
  try {
    const snap = await adminDb.collection('admin_notifications').orderBy('createdAt', 'desc').limit(200).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[GET notifications]', e);
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/admin/notifications/read-all', requireDb, async (_req, res) => {
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

router.patch('/api/admin/notifications/:id/read', requireDb, async (req, res) => {
  try {
    await adminDb.collection('admin_notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/admin/notifications/clear-all', requireDb, async (_req, res) => {
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
    await adminDb.collection('client_notifications').doc(req.params.id).update({ read: true });
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
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if ((clientData.balance || 0) < amount)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    // ── Manual pending flow ───────────────────────────────────────────────────
    const batch = adminDb.batch();
    batch.update(clientRef, {
      balance: Math.max(0, (clientData.balance || 0) - amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const txRef = adminDb.collection('client_transactions').doc();
    batch.set(txRef, {
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
    const adminWithdrawNotif = {
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
    const notifRef = adminDb.collection('admin_notifications').doc();
    batch.set(notifRef, adminWithdrawNotif);
    await batch.commit();
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
    const { agentCode, clientId, type, amount, note } = req.body;
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
    const { agentId, uid, email } = req.body as { agentId?: string; uid?: string; email?: string };
    if (!agentId || !uid || !email) {
      return res.status(400).json({ error: 'agentId, uid et email sont requis.' });
    }

    const agentRef = adminDb.collection('agents').doc(agentId);
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) {
      return res.status(404).json({ error: 'Agent introuvable.' });
    }

    const storedEmail: string | undefined = agentSnap.data()?.email;
    if (!storedEmail || storedEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: "L'email ne correspond pas au compte agent." });
    }

    await agentRef.update({
      uid,
      email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[Agent link-uid]', e);
    res.status(500).json({ error: e.message });
  }
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
    await confirmRef.update({ status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });

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

    // OTP verification: only required when an OTP was generated (otpHash present)
    if (confirmData.otpHash) {
      if (!otpCode) return res.status(400).json({ error: 'Code OTP requis.' });
      const submittedHash = createHash('sha256').update(String(otpCode)).digest('hex');
      if (submittedHash !== confirmData.otpHash) {
        return res.status(403).json({ error: 'Code OTP incorrect.' });
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
      const cSnap = await txn.get(clientRef);
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

    await confirmRef.update({ status: 'rejected', rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

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
      // Re-fetch client balance inside transaction
      const clientRef = adminDb.collection('clients').doc(txData.clientId);
      const clientSnap = await txn.get(clientRef);
      if (!clientSnap.exists) throw new Error('Client introuvable.');
      const clientBalance = clientSnap.data()!.balance || 0;
      if (clientBalance < amount) throw new Error('Solde client insuffisant pour ce retrait.');

      // Re-fetch agent balance inside transaction for consistency
      const agentSnapTxn = await txn.get(agentRef);
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

    const batch = adminDb.batch();
    // Reject tx (no balance changes since balance wasn't debited at request time)
    batch.update(txRef, {
      status: 'rejected',
      ...(reason && { rejectionReason: reason }),
      agentRejectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Client notification
    batch.set(adminDb.collection('client_notifications').doc(), {
      clientId: txData.clientId,
      type: 'withdrawal_rejected',
      title: '❌ Demande de retrait refusée',
      message: `Votre demande de retrait de $${amount.toFixed(2)} via l'agent ${agentData.name} a été refusée.${reason ? ` Raison: ${reason}` : ''}`,
      amount, read: false, createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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

// ── Agent: personal deposit (client deposits into agent wallet) ───────────────
router.post('/api/agent/personal-deposit', requireDb, async (req, res) => {
  try {
    const { agentCode, amount, method, accountNumber, accountName, message } = req.body;
    if (!agentCode || !amount || !method) return res.status(400).json({ error: 'Champs requis manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(400).json({ error: 'Agent inactif.' });

    const txRef = adminDb.collection('agent_personal_transactions').doc();
    const batch = adminDb.batch();
    batch.set(txRef, {
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      type: 'deposit',
      amount: usd,
      method,
      ...(accountNumber && { accountNumber }),
      ...(accountName && { accountName }),
      ...(message && { message }),
      status: 'pending',
      description: `Dépôt personnel — ${method}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(adminDb.collection('admin_notifications').doc(), {
      type: 'agent_personal_deposit',
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      amount: usd,
      method,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
    const { agentCode, amount, method, accountNumber, accountName, message } = req.body;
    if (!agentCode || !amount || !method || !accountNumber) return res.status(400).json({ error: 'Champs requis manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });

    const agentSnap = await adminDb.collection('agents').where('agentCode', '==', agentCode).limit(1).get();
    if (agentSnap.empty) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentDoc = agentSnap.docs[0];
    const agentData = agentDoc.data();
    if (agentData.status === 'inactive') return res.status(400).json({ error: 'Agent inactif.' });

    const commissionBalance = Number(agentData.commissionBalance || 0);
    if (commissionBalance < usd) return res.status(400).json({ error: `Solde commissions insuffisant. Disponible: $${commissionBalance.toFixed(2)}` });

    const txRef = adminDb.collection('agent_personal_transactions').doc();
    const batch = adminDb.batch();

    // Debit commission balance immediately
    batch.update(agentDoc.ref, {
      commissionBalance: FieldValue.increment(-usd),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(txRef, {
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      type: 'withdrawal',
      amount: usd,
      method,
      accountNumber,
      ...(accountName && { accountName }),
      ...(message && { message }),
      status: 'pending',
      description: `Retrait commissions — ${method} — ${accountNumber}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(adminDb.collection('admin_notifications').doc(), {
      type: 'agent_personal_withdrawal',
      agentId: agentDoc.id,
      agentCode,
      agentName: agentData.name || '',
      amount: usd,
      method,
      accountNumber,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
      const agentSnap = await txn.get(agentRef);
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
        txn.update(agentRef, { commissionBalance: FieldValue.increment(txData.amount), updatedAt: FieldValue.serverTimestamp() });
        txn.update(txRef, { status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      });
    } else {
      await txRef.update({ status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
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
    await txRef.update({ status: 'approved', approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
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

    // Load sender
    const senderRef = adminDb.collection('clients').doc(senderClientId);
    const senderSnap = await senderRef.get();
    if (!senderSnap.exists) return res.status(404).json({ error: 'Expéditeur introuvable.' });
    const senderData = senderSnap.data()!;
    if ((senderData.balance || 0) < usd)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    // Find recipient by walletId
    const recipSnap = await adminDb.collection('clients')
      .where('walletId', '==', recipientWalletId.trim()).limit(1).get();
    if (recipSnap.empty)
      return res.status(404).json({ error: 'Aucun wallet trouvé avec cet ID.' });
    const recipDoc = recipSnap.docs[0];
    if (recipDoc.id === senderClientId)
      return res.status(400).json({ error: 'Vous ne pouvez pas vous transférer à vous-même.' });
    const recipData = recipDoc.data()!;

    // Load transfer fee
    const settSnap = await adminDb.collection('settings').doc('global').get();
    const transferFeePercent = settSnap.exists ? (settSnap.data()!.transferFeePercent || 0) : 0;
    const feeAmount = transferFeePercent > 0
      ? parseFloat((usd * transferFeePercent / 100).toFixed(4))
      : 0;
    const netToRecipient = usd - feeAmount;

    if ((senderData.balance || 0) < usd)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const batch = adminDb.batch();
    // Debit sender (full amount)
    batch.update(senderRef, {
      balance: Math.max(0, (senderData.balance || 0) - usd),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Credit recipient (net after fee)
    batch.update(recipDoc.ref, {
      balance: (recipData.balance || 0) + netToRecipient,
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Accumulate fee in settings
    if (feeAmount > 0) {
      batch.update(adminDb.collection('settings').doc('global'), {
        feesBalance: FieldValue.increment(feeAmount),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    // Sender tx
    const senderTxRef = adminDb.collection('client_transactions').doc();
    batch.set(senderTxRef, {
      clientId: senderClientId, clientName: senderData.name || '',
      type: 'withdrawal', amount: usd, usdAmount: usd,
      status: 'completed', method: 'Transfert Wallet',
      description: `Transfert vers ${recipData.name || recipientWalletId}${feeAmount > 0 ? ` (frais: $${feeAmount.toFixed(2)})` : ''}${message ? ` — ${message}` : ''}`,
      recipientWalletId: recipientWalletId.trim(),
      recipientName: recipData.name || '',
      ...(message && { message }),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    // Recipient tx
    const recipTxRef = adminDb.collection('client_transactions').doc();
    batch.set(recipTxRef, {
      clientId: recipDoc.id, clientName: recipData.name || '',
      type: 'transfer_received', amount: netToRecipient, usdAmount: netToRecipient,
      status: 'completed', method: 'Transfert Wallet',
      description: `Reçu de ${senderData.name || senderClientId}${message ? ` — ${message}` : ''}`,
      senderWalletId: senderData.walletId || '',
      senderName: senderData.name || '',
      ...(message && { message }),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    res.json({ success: true, recipientName: recipData.name || '', amount: netToRecipient, fee: feeAmount });
  } catch (e: any) {
    console.error('[transfer]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
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
    const { affiliateId, clientId, type, amount, note } = req.body;
    if (!affiliateId || !clientId || !type || !amount)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0) return res.status(400).json({ error: 'Montant invalide.' });
    if (!['deposit', 'withdrawal'].includes(type)) return res.status(400).json({ error: 'Type invalide.' });

    const affRef = adminDb.collection('affiliates').doc(affiliateId);
    const affSnap = await affRef.get();
    if (!affSnap.exists) return res.status(403).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;

    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;

    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();

    if (type === 'deposit') {
      // Affiliate gives digital credit → affiliate.balance decreases, client.balance increases
      if ((affData.balance || 0) < usd)
        return res.status(400).json({ error: 'Solde affilié insuffisant pour ce dépôt.' });
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
      if ((clientData.balance || 0) < usd)
        return res.status(400).json({ error: 'Solde client insuffisant.' });
      if ((affData.balance || 0) < usd)
        return res.status(400).json({ error: 'Solde affilié insuffisant pour effectuer ce retrait.' });
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

    await batch.commit();
    res.json({ success: true, clientName: clientData.name || '', newClientBalance: (clientData.balance || 0) + (type === 'deposit' ? usd : -usd) });
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
    const { affiliateId } = req.body;
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

    const batch = adminDb.batch();
    // Client debited full amount (loses digital)
    batch.update(clientRef, { balance: FieldValue.increment(-amount), updatedAt: now });
    // Affiliate also debited (they pay cash out of their float); they keep their fee commission share
    batch.update(affRef, { balance: FieldValue.increment(-amount + affiliateShare), updatedAt: now });
    batch.update(txRef, { status: 'approved', updatedAt: now, confirmedAt: now, confirmedBy: affiliateId,
      ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare, adminFeeShare: adminShare }),
    });
    if (adminShare > 0) {
      batch.update(adminDb.collection('settings').doc('global'), {
        feesBalance: FieldValue.increment(adminShare),
        updatedAt: now,
      });
    }
    batch.set(adminDb.collection('affiliate_transactions').doc(), {
      affiliateId, type: 'client_withdrawal_given', amount,
      clientId: txData.clientId, clientName: txData.clientName || '',
      description: `Retrait cash remis à ${txData.clientName}`, status: 'completed',
      ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare }),
      createdAt: now,
    });

    await batch.commit();

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
    await txRef.update({ status: 'rejected', updatedAt: now, rejectedAt: now, rejectionReason: reason || '' });

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
    const { affiliateId } = req.body;
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

    const batch = adminDb.batch();
    // Affiliate spends (amount - affiliateShare) from their float
    batch.update(affRef, { balance: FieldValue.increment(-(amount - affiliateShare)), updatedAt: now });
    // Client receives net amount (after fee)
    batch.update(clientRef, { balance: FieldValue.increment(netToClient), updatedAt: now });
    batch.update(txRef, { status: 'approved', updatedAt: now, confirmedAt: now,
      ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare, adminFeeShare: adminShare }),
    });
    if (adminShare > 0) {
      batch.update(adminDb.collection('settings').doc('global'), {
        feesBalance: FieldValue.increment(adminShare),
        updatedAt: now,
      });
    }
    batch.set(adminDb.collection('affiliate_transactions').doc(), {
      affiliateId, type: 'client_deposit_given', amount,
      clientId: txData.clientId, clientName: txData.clientName || '',
      description: `Dépôt confirmé pour ${txData.clientName}`, status: 'completed',
      ...(feeAmount > 0 && { fee: feeAmount, affiliateFeeShare: affiliateShare }),
      createdAt: now,
    });

    await batch.commit();

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
    await txRef.update({ status: 'rejected', updatedAt: now, rejectionReason: reason || '' });

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
    const { affiliateId, amount, method, walletType } = req.body;
    if (!affiliateId || !amount || !method)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
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
    const { affiliateId, amount, method, accountNumber, walletType } = req.body;
    if (!affiliateId || !amount || !method || !accountNumber)
      return res.status(400).json({ error: 'Paramètres manquants.' });
    const usd = Number(amount);
    if (isNaN(usd) || usd <= 0)
      return res.status(400).json({ error: 'Montant invalide.' });

    const affSnap = await adminDb.collection('affiliates').doc(affiliateId).get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });
    const affData = affSnap.data()!;
    const isCommissions = walletType === 'commissions';
    const walletField = isCommissions ? 'totalEarnings' : 'balance';
    const walletBalance = Number(affData[walletField] || 0);
    if (walletBalance < usd)
      return res.status(400).json({ error: `Solde insuffisant. Disponible: $${walletBalance.toFixed(2)}` });

    const batch = adminDb.batch();
    const withdrawRef = adminDb.collection('withdrawals').doc();
    const walletLabel = isCommissions ? 'Wallet Commissions' : 'Wallet Principal';
    batch.set(withdrawRef, {
      affiliateId,
      affiliateName: affData.name || '',
      affiliateCode: affData.code || '',
      amount: usd,
      method,
      accountNumber,
      walletType: walletType || 'principal',
      walletLabel,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const txRef = adminDb.collection('wallet_transactions').doc();
    batch.set(txRef, {
      affiliateId,
      type: 'withdrawal',
      amount: usd,
      status: 'pending',
      method,
      accountNumber,
      walletType: walletType || 'principal',
      description: `Retrait ${walletLabel} via ${method}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    // Deduct balance immediately on submission
    batch.update(adminDb.collection('affiliates').doc(affiliateId), {
      [walletField]: FieldValue.increment(-usd),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
router.delete('/api/client/transactions/:clientId', requireDb, async (req, res) => {
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
  if (req.headers['x-admin-secret'] !== 'rena-admin-2024')
    return res.status(403).json({ error: 'Non autorisé.' });
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
    const affSnap = await affRef.get();
    if (!affSnap.exists) return res.status(404).json({ error: 'Affilié introuvable.' });

    const batch = adminDb.batch();
    batch.update(affRef, {
      balance: FieldValue.increment(amountUSD), totalEarnings: FieldValue.increment(amountUSD),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const notifRef = adminDb.collection('notifications').doc();
    batch.set(notifRef, {
      affiliateId, title: 'Commission Manuelle',
      message: `Vous avez reçu une commission manuelle de ${amountHTG} Goud (~${amountUSD.toFixed(2)} $)${reason ? ` — ${reason}` : ''}.`,
      type: 'revenue', read: false, createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    if ((clientData.balance || 0) < amount)
      return res.status(400).json({ error: 'Solde insuffisant pour cet achat.' });

    const batch = adminDb.batch();
    batch.update(clientRef, {
      balance: Math.max(0, (clientData.balance || 0) - amount),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const txRef = adminDb.collection('client_transactions').doc();
    batch.set(txRef, {
      clientId, clientName, type: 'purchase', amount, status: 'completed',
      productName, productPrice, directSponsorId: directSponsorId || null,
      affiliateCredited: !!directSponsorId,
      description: `Achat: ${productName} - ${productPrice}`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const notifRef = adminDb.collection('admin_notifications').doc();
    batch.set(notifRef, {
      type: 'client_purchase', clientId, clientName,
      clientPhone: clientPhone || '', clientWalletId: clientWalletId || '',
      transactionId: txRef.id, amount, productName, productPrice,
      directSponsorId: directSponsorId || null,
      commissionAutoSent: !!directSponsorId,
      status: 'completed',
      read: false, createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
      () => emailPurchase({ clientName, clientEmail: clientData.email, productName, amount }),
      { type: 'purchase', to: [ADMIN_EMAIL, ...(clientData.email ? [clientData.email] : [])], clientId, amount }
    );

    res.json({ success: true, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[purchase]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

router.post('/api/admin/purchase/approve', requireDb, async (req, res) => {
  try {
    const { notifId, transactionId, clientId } = req.body;
    if (!notifId || !transactionId)
      return res.status(400).json({ error: 'Paramètres manquants.' });

    const batch = adminDb.batch();
    batch.update(adminDb.collection('client_transactions').doc(transactionId), {
      status: 'completed', updatedAt: FieldValue.serverTimestamp(),
    });
    batch.update(adminDb.collection('admin_notifications').doc(notifId), {
      status: 'approved', read: true, resolvedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    if (clientId) {
      sendFcmToClient(
        clientId,
        '✅ Service traité',
        'Votre service a été traité avec succès. Merci pour votre confiance !',
        { type: 'purchase_approved', txId: transactionId }
      );
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

// ── Admin: affiliate withdrawal approve / reject ───────────────────────────────
router.post('/api/admin/withdrawal/:id/approve', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const requestRef = adminDb.collection('withdrawals').doc(id);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const requestData = requestSnap.data()!;
    if (requestData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    const batch = adminDb.batch();

    batch.update(requestRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });

    // Sync the linked wallet_transaction if one exists
    const snapTx = await adminDb.collection('wallet_transactions')
      .where('affiliateId', '==', requestData.affiliateId)
      .where('type', '==', 'withdrawal')
      .where('amount', '==', requestData.amount)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!snapTx.empty) {
      batch.update(snapTx.docs[0].ref, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });
    }

    // Track total withdrawn (balance already deducted on submission)
    const affiliateRef = adminDb.collection('affiliates').doc(requestData.affiliateId);
    batch.update(affiliateRef, {
      totalWithdrawn: FieldValue.increment(requestData.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Affiliate notification
    batch.set(adminDb.collection('affiliate_notifications').doc(), {
      affiliateId: requestData.affiliateId,
      title: '✅ Retrait approuvé',
      message: `Votre demande de retrait de $${requestData.amount} a été approuvée. Vous serez payé sur ${requestData.method} dans les plus brefs délais.`,
      type: 'system',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    const notifData = {
      affiliateId: requestData.affiliateId,
      title: '✅ Retrait approuvé',
      message: `Votre demande de retrait de $${requestData.amount} a été approuvée. Vous serez payé sur ${requestData.method} dans les plus brefs délais.`,
      type: 'withdrawal_approved',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    const notifRef = adminDb.collection('affiliate_notifications').doc();
    batch.set(notifRef, notifData);

    await batch.commit();

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

    const batch = adminDb.batch();

    batch.update(requestRef, {
      status: 'rejected',
      rejectionReason: reason || '',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Sync the linked wallet_transaction if one exists
    const snapTx = await adminDb.collection('wallet_transactions')
      .where('affiliateId', '==', requestData.affiliateId)
      .where('type', '==', 'withdrawal')
      .where('amount', '==', requestData.amount)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!snapTx.empty) {
      batch.update(snapTx.docs[0].ref, { status: 'rejected', updatedAt: FieldValue.serverTimestamp() });
    }

    // Refund affiliate balance (was deducted on submission)
    const walletRefField = requestData.walletType === 'commissions' ? 'totalEarnings' : 'balance';
    const affiliateRefReject = adminDb.collection('affiliates').doc(requestData.affiliateId);
    batch.update(affiliateRefReject, {
      [walletRefField]: FieldValue.increment(requestData.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const rejectNotifData = {
      affiliateId: requestData.affiliateId,
      title: '❌ Retrait refusé',
      message: `Votre demande de retrait de ${requestData.amount} a été refusée.${reason ? ` Raison : ${reason}` : ''}`,
      type: 'withdrawal_rejected',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    const rejectNotifRef = adminDb.collection('affiliate_notifications').doc();
    batch.set(rejectNotifRef, rejectNotifData);

    await batch.commit();

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

    const batch = adminDb.batch();
    batch.update(txRef, {
      status,
      ...(reason && { rejectionReason: reason }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const clientRef = adminDb.collection('clients').doc(txData.clientId);
    const clientSnap = await clientRef.get();
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
    await batch.commit();

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
    const { amount } = req.body;
    const settingsRef = adminDb.collection('settings').doc('global');
    const snap = await settingsRef.get();
    const current = snap.exists ? (snap.data()!.feesBalance || 0) : 0;
    if (current <= 0) return res.status(400).json({ error: 'Aucun frais à retirer.' });
    await settingsRef.update({
      feesBalance: 0,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await adminDb.collection('admin_notifications').add({
      type: 'fees_withdrawal',
      amount: amount || current,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, withdrawn: current });
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
    const agentSnap = await agentRef.get();
    if (!agentSnap.exists) return res.status(404).json({ error: 'Agent introuvable.' });
    const agentData = agentSnap.data()!;

    const field = wallet === 'commission' ? 'commissionBalance' : 'balance';
    const delta = type === 'credit' ? usd : -usd;
    const currentVal = Number(agentData[field] || 0);

    if (type === 'debit' && currentVal < usd) {
      return res.status(400).json({ error: `Solde insuffisant (${currentVal.toFixed(2)} $).` });
    }

    const logRef = adminDb.collection('agent_wallet_adjustments').doc();
    const batch = adminDb.batch();
    batch.update(agentRef, {
      [field]: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(logRef, {
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
    await batch.commit();

    res.json({ success: true });
  } catch (e: any) {
    console.error('[admin/agent/wallet/adjust]', e);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Admin: toggle agent wallet lock ──────────────────────────────────────────
router.post('/api/admin/agent/:agentId/toggle-lock', requireDb, async (req, res) => {
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
      name, phone, email, password, balance: 0, walletId, status: 'active',
      ...(directSponsorId && { directSponsorId }),
      ...(indirectSponsorId && { indirectSponsorId }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const ref = await adminDb.collection('clients').add(clientData);
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
    console.error('[register]', e);
    res.status(500).json({ error: e.message || "Erreur lors de l'inscription." });
  }
});

router.post('/api/client/login', requireDb, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
    const snap = await adminDb.collection('clients')
      .where('email', '==', email).where('password', '==', password).limit(1).get();
    if (snap.empty) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    res.json({ success: true, client: serializeDoc(snap.docs[0]) });
  } catch (e: any) {
    console.error('[login]', e);
    res.status(500).json({ error: e.message || 'Erreur de connexion.' });
  }
});

router.post('/api/client/register-google', requireDb, async (req, res) => {
  try {
    const { phone, sponsorCode, googleUser } = req.body;
    if (!googleUser?.email || !googleUser?.uid)
      return res.status(400).json({ error: 'Données Google manquantes.' });

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
  if (req.headers['x-admin-secret'] !== 'rena-admin-2024')
    return res.status(403).json({ error: 'Non autorisé.' });
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
  if (req.headers['x-admin-secret'] !== 'rena-admin-2024')
    return res.status(403).json({ error: 'Non autorisé.' });
  try {
    await adminDb.collection('online_sub_services').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Formations — Public & User ─────────────────────────────────────────────────
router.use('/api/formations', requireDb);

router.get('/api/formations', async (_req, res) => {
  try {
    const snap = await adminDb.collection('formations').orderBy('createdAt', 'desc').get();
    const formations = snap.docs.map(serializeDoc).filter((f: any) => f.published || f.comingSoon);
    res.json({ formations });
  } catch (e: any) {
    console.error('[formations public GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.get('/api/formations/purchases/user/:userId', async (req, res) => {
  try {
    const snap = await adminDb.collection('formation_purchases')
      .where('userId', '==', req.params.userId).get();
    res.json({ purchases: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations purchases GET user]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.post('/api/formations/purchases', async (req, res) => {
  try {
    const { userId, userEmail, userName, formationId, formationTitle, amount, method } = req.body;
    if (!userId || !formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
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

router.post('/api/formations/purchases/wallet', async (req, res) => {
  try {
    const { clientId, clientName, formationId, formationTitle, amount } = req.body;
    if (!clientId || !formationId) return res.status(400).json({ error: 'Paramètres manquants.' });

    const existingSnap = await adminDb.collection('formation_purchases')
      .where('userId', '==', clientId).where('formationId', '==', formationId).where('status', '==', 'active').get();
    if (!existingSnap.empty) return res.json({ success: true, alreadyOwned: true });

    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;

    const price = Number(amount) || 0;
    if (price > 0 && (clientData.balance || 0) < price)
      return res.status(400).json({ error: 'Solde insuffisant.' });

    const batch = adminDb.batch();
    if (price > 0) {
      batch.update(clientRef, {
        balance: Math.max(0, (clientData.balance || 0) - price),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const purchaseRef = adminDb.collection('formation_purchases').doc();
    batch.set(purchaseRef, {
      userId: clientId, userEmail: clientData.email || '',
      userName: clientName || clientData.name || '',
      formationId, formationTitle: formationTitle || '',
      amount: price, method: price === 0 ? 'Gratuit' : 'Wallet',
      status: 'active',
      purchasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (formationId) {
      batch.update(adminDb.collection('formations').doc(formationId), {
        studentsCount: FieldValue.increment(1),
      });
    }
    if (price > 0) {
      const notifRef = adminDb.collection('admin_notifications').doc();
      batch.set(notifRef, {
        type: 'formation_purchase', clientId,
        clientName: clientName || clientData.name || '',
        formationId, formationTitle: formationTitle || '',
        amount: price, method: 'Wallet',
        read: false, createdAt: FieldValue.serverTimestamp(),
      });
    }
    // Credit teacher if formation belongs to one (minus platform commission)
    if (price > 0 && formationId) {
      try {
        const [formSnap, feeSettingsSnap] = await Promise.all([
          adminDb.collection('formations').doc(formationId).get(),
          adminDb.collection('settings').doc('main').get(),
        ]);
        const teacherId = formSnap.exists ? formSnap.data()!.teacherId : null;
        const teacherName = formSnap.exists ? formSnap.data()!.teacherName : null;
        const formationFee = feeSettingsSnap.exists ? (feeSettingsSnap.data()!.formationPurchaseFee ?? 0) : 0;
        const platformCut = Math.round(price * formationFee) / 100;
        const teacherAmount = price - platformCut;
        if (teacherId && teacherAmount > 0) {
          const teacherRef = adminDb.collection('teachers').doc(teacherId);
          const teacherSnap = await teacherRef.get();
          if (teacherSnap.exists) {
            const currentBalance = teacherSnap.data()!.balance || 0;
            const teacherBatch = adminDb.batch();
            teacherBatch.update(teacherRef, {
              balance: currentBalance + teacherAmount,
              updatedAt: FieldValue.serverTimestamp(),
            });
            const txRef = adminDb.collection('teacher_transactions').doc();
            teacherBatch.set(txRef, {
              teacherId,
              teacherName: teacherName || '',
              type: 'sale_credit',
              amount: teacherAmount,
              platformFee: platformCut,
              formationId,
              formationTitle: formationTitle || '',
              clientName: clientName || clientData.name || '',
              status: 'completed',
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            await teacherBatch.commit();
          }
        }
      } catch (teacherErr: any) {
        console.error('[formations/purchases/wallet] teacher credit error:', teacherErr.message);
      }
    }

    await batch.commit();

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

router.post('/api/formations/free-access', async (req, res) => {
  try {
    const { userId, userEmail, userName, formationId, formationTitle } = req.body;
    if (!userId || !formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
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

router.post('/api/formations/payment-request', async (req, res) => {
  try {
    const { userId, userEmail, userName, formationId, formationTitle, amount, method, transactionCode } = req.body;
    if (!userId || !formationId || !method || !transactionCode)
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
router.get('/api/formations/progress/:userId', async (req, res) => {
  try {
    const snap = await adminDb.collection('formation_progress')
      .where('userId', '==', req.params.userId).get();
    res.json({ progress: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    console.error('[formations progress GET]', e);
    res.status(500).json({ error: e.message || 'Erreur.' });
  }
});

router.get('/api/formations/progress/:userId/:formationId', async (req, res) => {
  try {
    const { userId, formationId } = req.params;
    const snap = await adminDb.collection('formation_progress').doc(`${userId}_${formationId}`).get();
    if (!snap.exists) return res.json({ progress: null });
    res.json({ progress: { id: snap.id, ...snap.data() } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/formations/progress', async (req, res) => {
  try {
    const { userId, userEmail, formationId, moduleId, totalModules } = req.body;
    if (!userId || !formationId || !moduleId || !totalModules)
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

router.post('/api/formations/progress/complete', async (req, res) => {
  try {
    const { userId, formationId, moduleId } = req.body;
    if (!userId || !formationId || !moduleId)
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

router.post('/api/formations/progress/position', async (req, res) => {
  try {
    const { userId, formationId, moduleId, positionSeconds } = req.body;
    if (!userId || !formationId) return res.status(400).json({ error: 'Paramètres manquants.' });
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

// ── Admin secret guard (timing-safe comparison) ───────────────────────────────
const _ADMIN_SECRET_BUF = Buffer.from('rena-admin-2024');
const requireAdminSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const supplied = String(req.headers['x-admin-secret'] || '');
  const buf = Buffer.alloc(_ADMIN_SECRET_BUF.length);
  buf.write(supplied);
  const ok = supplied.length === _ADMIN_SECRET_BUF.length && timingSafeEqual(buf, _ADMIN_SECRET_BUF);
  if (!ok) return res.status(403).json({ error: 'Non autorisé.' });
  next();
};

// ── Admin Login (server-side — élimine la dépendance à l'auth anonyme) ───────
router.post('/api/admin/login', requireDb, async (req, res) => {
  try {
    const { fullName, password, loginCode } = req.body;
    if (!fullName || !password)
      return res.status(400).json({ error: 'Identifiants requis.' });

    const snap = await adminDb.collection('admin_accounts').where('fullName', '==', fullName).limit(1).get();
    if (snap.empty) {
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const adminDoc = snap.docs[0];
    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };

    if (adminData.lockUntil) {
      const lockDate = adminData.lockUntil?.toDate ? adminData.lockUntil.toDate() : new Date(adminData.lockUntil);
      if (lockDate > new Date())
        return res.status(403).json({ error: 'Compte bloqué temporairement. Réessayez plus tard.' });
    }

    if (adminData.password !== password) {
      const newAttempts = (adminData.failedAttempts || 0) + 1;
      const upd: any = { failedAttempts: newAttempts };
      if (newAttempts >= 5) upd.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await adminDoc.ref.update(upd);
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (adminData.isSuperAdmin && adminData.loginCode && adminData.loginCode !== loginCode) {
      await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: false, timestamp: FieldValue.serverTimestamp() });
      return res.status(401).json({ error: 'Code de connexion incorrect.' });
    }

    await adminDoc.ref.update({ failedAttempts: 0, lockUntil: null, updatedAt: FieldValue.serverTimestamp() });
    await adminDb.collection('admin_login_logs').add({ adminName: fullName, success: true, timestamp: FieldValue.serverTimestamp() });

    res.json({ success: true, admin: serializeDoc(adminDoc) });
  } catch (e: any) {
    console.error('[admin/login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

// ── Admin: Verify Google login (server-side writes via Admin SDK) ─────────────
router.post('/api/admin/verify-google', requireDb, async (req, res) => {
  try {
    const { email, uid } = req.body;
    if (!email || !uid) return res.status(400).json({ error: 'Données manquantes.' });

    let adminSnap = await adminDb.collection('admin_accounts').where('email', '==', email.toLowerCase()).limit(1).get();
    if (adminSnap.empty) {
      adminSnap = await adminDb.collection('admin_accounts').where('uid', '==', uid).limit(1).get();
    }
    if (adminSnap.empty) {
      await adminDb.collection('admin_login_logs').add({ adminName: email, success: false, timestamp: FieldValue.serverTimestamp() });
      return res.status(403).json({ error: `Accès refusé. L'adresse "${email}" n'est associée à aucun compte administrateur Rena.` });
    }

    const adminDoc = adminSnap.docs[0];
    const adminData: any = { id: adminDoc.id, ...adminDoc.data() };

    if (adminData.lockUntil) {
      const lockDate = adminData.lockUntil?.toDate ? adminData.lockUntil.toDate() : new Date(adminData.lockUntil);
      if (lockDate > new Date()) {
        return res.status(403).json({ error: 'Compte bloqué temporairement. Réessayez plus tard.' });
      }
    }

    const updates: any = { failedAttempts: 0, updatedAt: FieldValue.serverTimestamp() };
    if (!adminData.uid) updates.uid = uid;
    if (!adminData.email) updates.email = email.toLowerCase();
    await adminDoc.ref.update(updates);

    await adminDb.collection('admin_login_logs').add({ adminName: adminData.fullName, success: true, timestamp: FieldValue.serverTimestamp() });

    res.json({ success: true, admin: serializeDoc(adminDoc) });
  } catch (e: any) {
    console.error('[admin/verify-google]', e);
    res.status(500).json({ error: 'Erreur vérification Google.' });
  }
});

// ── Admin: Link Google account to existing admin (verify creds first) ────────
router.post('/api/admin/link-google', requireDb, async (req, res) => {
  try {
    const { loginCode, email, uid } = req.body;
    if (!loginCode || !email || !uid)
      return res.status(400).json({ error: 'Données manquantes.' });

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
    await adminDb.collection('admin_login_logs').add({ adminName: adminData.fullName, success: true, timestamp: FieldValue.serverTimestamp() });

    const updated = await adminDoc.ref.get();
    res.json({ success: true, admin: serializeDoc(updated) });
  } catch (e: any) {
    console.error('[admin/link-google]', e);
    res.status(500).json({ error: 'Erreur lors de la liaison du compte.' });
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

// ── Admin: Bootstrap Super Admin (idempotent, no auth required) ───────────────
router.post('/api/admin/bootstrap', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('admin_accounts').limit(1).get();
    if (!snap.empty) return res.json({ success: true, bootstrapped: false });
    const ts = FieldValue.serverTimestamp();
    const ref = await adminDb.collection('admin_accounts').add({
      fullName: 'Ernst israel',
      password: '$Ernst509@$',
      loginCode: 'ER-2026',
      isSuperAdmin: true,
      permissions: ['all'],
      failedAttempts: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    console.log('[Bootstrap] Super Admin créé:', ref.id);
    res.json({ success: true, bootstrapped: true });
  } catch (e: any) {
    console.error('[Bootstrap] Erreur:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: Admin Accounts CRUD ────────────────────────────────────────────────
router.post('/api/admin/account', requireDb, requireAdminSecret, async (req, res) => {
  try {
    const { id, createdAt: _c, updatedAt: _u, ...data } = req.body;
    const ts = FieldValue.serverTimestamp();
    if (id) {
      await adminDb.collection('admin_accounts').doc(id).update({ ...data, updatedAt: ts });
      return res.json({ success: true, id });
    }
    const ref = await adminDb.collection('admin_accounts').add({
      ...data, failedAttempts: 0, createdAt: ts, updatedAt: ts,
    });
    res.json({ success: true, id: ref.id });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/admin/account/:id', requireDb, requireAdminSecret, async (req, res) => {
  try {
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
    webpush.setVapidDetails('mailto:renaservices@gmail.com', VAPID_PUBLIC_KEY, privKey);
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

router.post('/api/push/send', requireDb, async (req, res) => {
  if (req.headers['x-admin-secret'] !== 'rena-admin-2024')
    return res.status(403).json({ error: 'Non autorisé.' });
  if (!pushEnabled)
    return res.status(503).json({ error: 'Push notifications non configurées.' });

  const { title, body, url, tag } = req.body;
  const payload = JSON.stringify({ title: title || 'Rena', body: body || '', url: url || '/', tag: tag || 'rena-notif', icon: '/icon.svg', badge: '/icon.svg' });

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
    const payload = JSON.stringify({ title, body, url, icon: '/icon.svg', badge: '/icon.svg', tag: 'rena-admin' });
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
router.post('/api/formations/quiz/submit', requireDb, async (req, res) => {
  try {
    const { userId, formationId, chapterId, answers } = req.body;
    if (!userId || !formationId || !chapterId || !Array.isArray(answers))
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
router.get('/api/formations/quiz/results/:userId/:formationId', requireDb, async (req, res) => {
  try {
    const { userId, formationId } = req.params;
    const snap = await adminDb.collection('formation_quiz_results')
      .where('userId', '==', userId).where('formationId', '==', formationId).get();
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Certificates: get for user + formation ────────────────────────────────────
router.get('/api/formations/certificate/:userId/:formationId', requireDb, async (req, res) => {
  try {
    const { userId, formationId } = req.params;
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
    const certificateCode = 'RENA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
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
    res.json({ success: true, teacher: { id: doc.id, ...data, password: undefined } });
  } catch (e: any) {
    console.error('[teacher/login]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
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
    res.json({ success: true, teacher: { id: docSnap.id, ...data, ...updates, password: undefined } });
  } catch (e: any) {
    console.error('[teacher/verify-google]', e);
    res.status(500).json({ error: 'Erreur lors de la connexion Google.' });
  }
});

router.get('/api/teacher/me/:id', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('teachers').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Professeur introuvable.' });
    const data = snap.data()!;
    res.json({ teacher: { id: snap.id, ...data, password: undefined } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/teacher/formations/:teacherId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('formations').where('teacherId', '==', req.params.teacherId).get();
    res.json({ formations: snap.docs.map(serializeDoc) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/teacher/formations', requireDb, async (req, res) => {
  try {
    const { teacherId, teacherName, ...rest } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'teacherId requis.' });
    const data = sanitizeFormation(rest);
    if (!data.title) return res.status(400).json({ error: 'Le titre est requis.' });
    const ref = await adminDb.collection('formations').add({
      ...data,
      teacherId,
      teacherName: teacherName || '',
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

router.put('/api/teacher/formations/:id', requireDb, async (req, res) => {
  try {
    const { teacherId, ...rest } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'teacherId requis.' });
    const formSnap = await adminDb.collection('formations').doc(req.params.id).get();
    if (!formSnap.exists) return res.status(404).json({ error: 'Formation introuvable.' });
    if (formSnap.data()!.teacherId !== teacherId) return res.status(403).json({ error: 'Accès refusé.' });
    const data = sanitizeFormation(rest);
    await adminDb.collection('formations').doc(req.params.id).update({
      ...data, updatedAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (e: any) {
    console.error('[teacher/formations PUT]', e);
    res.status(500).json({ error: e.message || 'Erreur lors de la mise à jour.' });
  }
});

router.delete('/api/teacher/formations/:id', requireDb, async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'teacherId requis.' });
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

router.post('/api/teacher/withdrawal', requireDb, async (req, res) => {
  try {
    const { teacherId, amount, method, accountNumber } = req.body;
    if (!teacherId || !amount || !method || !accountNumber)
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

router.get('/api/teacher/transactions/:teacherId', requireDb, async (req, res) => {
  try {
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
    await txRef.update({ status: 'approved', updatedAt: FieldValue.serverTimestamp() });

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
      const teacherSnap = await teacherRef.get();
      if (!teacherSnap.exists) return res.status(404).json({ error: 'Professeur introuvable.' });
      const teacherData = teacherSnap.data()!;
      const newBalance = Math.max(0, (teacherData.balance || 0) - (tx.amount || 0));
      const feeAmount = parseFloat(((tx.amount || 0) - (tx.netAmount || 0)).toFixed(4));
      const batch = adminDb.batch();
      batch.update(txRef, { status: 'approved', updatedAt: FieldValue.serverTimestamp() });
      batch.update(teacherRef, { balance: newBalance, updatedAt: FieldValue.serverTimestamp() });
      if (feeAmount > 0) {
        batch.update(adminDb.collection('settings').doc('global'), {
          feesBalance: FieldValue.increment(feeAmount),
          teacherWithdrawalFeesTotal: FieldValue.increment(feeAmount),
        });
      }
      await batch.commit();
    } else {
      await txRef.update({
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
    const snap = await settingsRef.get();
    const current = snap.exists ? (snap.data()!.feesBalance || 0) : 0;
    await settingsRef.set({
      feesBalance: 0,
      lastProfitReset: FieldValue.serverTimestamp(),
      teacherWithdrawalFeesTotal: 0,
      affiliateWithdrawalFeesTotal: 0,
    }, { merge: true });
    await adminDb.collection('admin_notifications').add({
      type: 'profit_reset',
      previousBalance: current,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, previousBalance: current });
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
router.get('/api/teacher/notifications/:teacherId', requireDb, async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!teacherId) return res.status(400).json({ error: 'teacherId requis.' });
    const snap = await adminDb.collection('teacher_notifications')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notifications: snap.docs.map(serializeDoc) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/teacher/notifications/:id/read', requireDb, async (req, res) => {
  try {
    await adminDb.collection('teacher_notifications').doc(req.params.id).update({ read: true });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.patch('/api/teacher/notifications/read-all/:teacherId', requireDb, async (req, res) => {
  try {
    const snap = await adminDb.collection('teacher_notifications')
      .where('teacherId', '==', req.params.teacherId).where('read', '==', false).get();
    const batch = adminDb.batch();
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete('/api/teacher/notifications/clear-all/:teacherId', requireDb, async (req, res) => {
  try {
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
const AI_CHAT_SYSTEM = `Tu es un développeur senior qui travaille EXCLUSIVEMENT sur le projet "Rena".

## Architecture Rena (mémorise-la)
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
2. **JAMAIS de conseils génériques** qui s'appliquent à n'importe quel projet Node/React. Chaque réponse doit être spécifique à Rena.
3. Cite toujours le fichier exact (\`src/api/router.ts\`, \`src/pages/AdminDashboard.tsx\`, etc.)
4. Pour du code : indique la fonction/section à modifier et fournis un extrait complet prêt à coller
5. Si tu ne sais pas quelque chose sur Rena, dis-le clairement — ne devine pas
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
const ERNST_SYSTEM = `Tu es Ernst, l'assistant IA personnel des agents de la plateforme Rena.
Rena est une plateforme logistique et fintech multi-rôles basée en Haïti.

## Ton rôle
Tu aides les agents Rena dans leurs tâches quotidiennes : dépôts, retraits, gestion des clients, commissions, portefeuille, procédures, et tout problème opérationnel qu'ils rencontrent.

## Ce que font les agents Rena
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
    const reqRef = adminDb.collection('client_agent_deposit_requests').doc(req.params.reqId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    const agentRef = adminDb.collection('agents').doc(reqData.agentId);
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
      const agentSnap = await txn.get(agentRef);
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
    const { reason } = req.body;
    const reqRef = adminDb.collection('client_agent_deposit_requests').doc(req.params.reqId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return res.status(404).json({ error: 'Demande introuvable.' });
    const reqData = reqSnap.data()!;
    if (reqData.status !== 'pending') return res.status(400).json({ error: 'Demande déjà traitée.' });

    const batch = adminDb.batch();
    batch.update(reqRef, { status: 'rejected', ...(reason && { rejectionReason: reason }), rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });

    // Client notification
    batch.set(adminDb.collection('client_notifications').doc(), {
      clientId: reqData.clientId,
      type: 'deposit_rejected',
      title: '❌ Demande de dépôt refusée',
      message: `Votre demande de dépôt de ${(reqData.amount || 0).toFixed(2)} a été refusée par l'agent ${reqData.agentName}.${reason ? ` Raison: ${reason}` : ''}`,
      amount: reqData.amount,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

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
    <p>Si vous lisez ceci, Resend est correctement configuré sur <strong>Rena</strong>.</p>
    <table style="border-collapse:collapse;width:100%;max-width:400px;">
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">FROM</td><td style="padding:8px;border:1px solid #eee;">${FROM_EMAIL}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">TO</td><td style="padding:8px;border:1px solid #eee;">${recipient}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;color:#888;">Date</td><td style="padding:8px;border:1px solid #eee;">${new Date().toLocaleString('fr-FR')}</td></tr>
    </table>
  </body></html>`;
  const result = await send(recipient, '✅ Test email Rena — Resend opérationnel', html, 'test_email');
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
    const orderId = `RENA-${String(clientId).slice(0, 8)}-${Date.now()}`;

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
    if (ipnSecret && sig) {
      const sorted   = JSON.stringify(sortObjectRecursive(req.body));
      const expected = createHmac('sha512', ipnSecret).update(sorted).digest('hex');
      if (sig.toLowerCase() !== expected.toLowerCase()) {
        console.warn('[crypto/ipn] Signature invalide — rejeté');
        return res.status(401).json({ error: 'Signature invalide.' });
      }
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
function fazerFetch(path: string, opts: RequestInit = {}) {
  const key = process.env.FAZER_CARDS_API_KEY;
  if (!key) throw new Error('FAZER_CARDS_API_KEY non configurée.');
  return fetch(`${FAZER_BASE}${path}`, {
    ...opts,
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

// GET /api/fazer/topups — list game categories (with cover images)
router.get('/api/fazer/topups', async (_req, res) => {
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
    const r = await fazerFetch(`/topups/offers?category_id=${encodeURIComponent(category_id)}&include_ui=1`);
    if (!r.ok) return res.status(r.status).json({ error: 'Erreur FazerCards.' });
    const data = await r.json() as any;
    const raw: any[] = Array.isArray(data) ? data : (data.items || data.offers || data.data || []);
    // Normalise: map price_usd (string) → price (float), keep other fields
    const items = raw.map((o: any) => ({
      ...o,
      price: typeof o.price === 'number' ? o.price : parseFloat(o.price_usd ?? o.price ?? '0') || 0,
    }));
    res.json({ items });
  } catch (e: any) {
    console.error('[fazer/topups/offers]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// GET /api/fazer/topups/validate-id — list games that support ID validation
router.get('/api/fazer/topups/validate-id', async (_req, res) => {
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
router.post('/api/fazer/topups/validate-id', async (req, res) => {
  try {
    const r = await fazerFetch('/topups/validate-id', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.ok ? 200 : r.status).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// POST /api/fazer/topups/order — place order, deduct wallet
router.post('/api/fazer/topups/order', requireDb, async (req, res) => {
  try {
    const { clientId, category_id, offer_id, fields, priceUSD } = req.body as {
      clientId: string; category_id: string; offer_id: string;
      fields: Record<string, string>; priceUSD: number;
    };
    if (!clientId || !category_id || !offer_id) return res.status(400).json({ error: 'Paramètres manquants.' });

    // 1. Check client balance
    const clientRef = adminDb.collection('clients').doc(clientId);
    const clientSnap = await clientRef.get();
    if (!clientSnap.exists) return res.status(404).json({ error: 'Client introuvable.' });
    const clientData = clientSnap.data()!;
    const price = Number(priceUSD) || 0;
    if (price > 0 && (clientData.balance || 0) < price)
      return res.status(400).json({ error: `Solde insuffisant. Disponible: ${clientData.balance?.toFixed(2)} USD.` });

    // 2. Place order with FazerCards
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

    // 3. Deduct wallet (batch: balance update + transaction log)
    const batch = adminDb.batch();
    if (price > 0) {
      batch.update(clientRef, {
        balance: Math.max(0, (clientData.balance || 0) - price),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    const txRef = adminDb.collection('client_transactions').doc();
    batch.set(txRef, {
      clientId, clientName: clientData.name || '',
      type: 'purchase', amount: price, status: 'completed',
      productName: fazerData.category_name || category_id,
      productPrice: `${price} USD`,
      description: `Top-up jeu: ${fazerData.category_name || category_id} (${fazerData.order_id || idempotencyKey})`,
      fazerOrderId: fazerData.order_id || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    res.json({ success: true, order: fazerData, transactionId: txRef.id });
  } catch (e: any) {
    console.error('[fazer/order]', e.message);
    res.status(500).json({ error: e.message || 'Erreur serveur.' });
  }
});

// ── Catch-all: unmatched /api/* → clean JSON 404 ─────────────────────────────
router.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

export { adminDb };
export default router;
