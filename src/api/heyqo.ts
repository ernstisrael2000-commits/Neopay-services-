import { createHash } from 'node:crypto';

export const HEYQO_BASE_URL =
  process.env.HEYQO_BASE_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://heyqo.cash/business/v1'
    : 'https://heyqo.cash/business/sandbox/v1');

type HeyQOResponse<T> = {
  data?: T;
  [key: string]: unknown;
};

export class HeyQOError extends Error {
  status: number;
  providerPayload: unknown;
  outcome: 'confirmed_rejected' | 'unknown' | 'not_sent';

  constructor(
    message: string,
    status = 502,
    providerPayload?: unknown,
    outcome: 'confirmed_rejected' | 'unknown' | 'not_sent' = 'unknown',
  ) {
    super(message);
    this.name = 'HeyQOError';
    this.status = status;
    this.providerPayload = providerPayload;
    this.outcome = outcome;
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentialsConfigured(): boolean {
  return Boolean(
    (process.env.HEYQO_CLIENT_ID || process.env.HEYQO_API_KEY) &&
    (process.env.HEYQO_SECRET_ID || process.env.HEYQO_API_SECRET),
  );
}

export function isHeyQOConfigured(): boolean {
  return credentialsConfigured();
}

export function getHeyQOEnvironment(): 'sandbox' | 'production' | 'custom' {
  if (HEYQO_BASE_URL === 'https://heyqo.cash/business/sandbox/v1') return 'sandbox';
  if (HEYQO_BASE_URL === 'https://heyqo.cash/business/v1') return 'production';
  return 'custom';
}

function collectProviderErrorMessages(value: unknown, output: string[] = [], depth = 0, field?: string): string[] {
  if (depth > 4 || value === null || value === undefined) return output;
  if (typeof value === 'string') {
    const message = value.replace(/\s+/g, ' ').trim();
    const formatted = field ? `${field} : ${message}` : message;
    if (formatted && !output.includes(formatted)) output.push(formatted);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectProviderErrorMessages(item, output, depth + 1, field));
    return output;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.message === 'string') {
      const recordField = typeof record.field === 'string' ? record.field : field;
      collectProviderErrorMessages(record.message, output, depth + 1, recordField);
      return output;
    }
    const hasMessageKey = ['message', 'error', 'errors', 'detail', 'details'].some((key) => key in record);
    Object.entries(record).forEach(([key, item]) => {
      collectProviderErrorMessages(item, output, depth + 1, hasMessageKey || key === 'code' ? field : key);
    });
  }
  return output;
}

export function providerMessage(payload: any, status: number): string {
  const nestedMessages = collectProviderErrorMessages(payload?.message?.error);
  if (nestedMessages.length) {
    return nestedMessages.join(' · ').slice(0, 240);
  }
  const message =
    payload?.error ||
    payload?.message ||
    payload?.detail ||
    payload?.data?.error ||
    payload?.data?.message;
  if (typeof message === 'string' && message.length < 240) return message;
  if (status === 402) return 'Le solde marchand HeyQO est insuffisant pour cette opération.';
  if (status === 401 || status === 403) return 'Les identifiants HeyQO sont invalides ou expirés.';
  return `HeyQO a refusé la demande (${status}).`;
}

export function normalizeHeyQOPhone(input: unknown, countryCode = 'HT'): string {
  const raw = String(input ?? '').trim();
  const compact = raw.replace(/[()\s-]/g, '');
  if (!compact) return '';

  if (compact.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : '';
  }

  if (compact.startsWith('00')) {
    const international = `+${compact.slice(2)}`;
    return /^\+[1-9]\d{7,14}$/.test(international) ? international : '';
  }

  if (!/^\d+$/.test(compact)) return '';
  const digits = compact.replace(/\D/g, '');
  if (String(countryCode).toUpperCase() === 'HT') {
    const haitianLocal = digits.replace(/^0(?=\d{8}$)/, '');
    if (/^\d{8}$/.test(haitianLocal)) return `+509${haitianLocal}`;
    if (/^509\d{8}$/.test(digits)) return `+${digits}`;
  }

  return '';
}

async function readPayload(response: Response): Promise<any> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 240) };
  }
}

async function getToken(): Promise<string> {
  if (!credentialsConfigured()) {
    throw new HeyQOError(
      'Le service Cartes est en attente de configuration HeyQO. Contactez l’administration.',
      503,
      undefined,
      'not_sent',
    );
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const response = await fetch(`${HEYQO_BASE_URL}/authentication/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.HEYQO_CLIENT_ID || process.env.HEYQO_API_KEY,
      secret_id: process.env.HEYQO_SECRET_ID || process.env.HEYQO_API_SECRET,
    }),
  });
  const payload = await readPayload(response);
  if (!response.ok) throw new HeyQOError(providerMessage(payload, response.status), response.status, payload, 'not_sent');

  const token = payload?.data?.access_token || payload?.access_token;
  if (typeof token !== 'string' || !token) {
    throw new HeyQOError('HeyQO n’a pas renvoyé de jeton d’accès valide.', 502, payload);
  }
  const expiresIn = Number(payload?.data?.expires_in || payload?.expires_in || 300);
  cachedToken = { value: token, expiresAt: Date.now() + Math.max(60, expiresIn) * 1000 };
  return token;
}

export async function heyqoRequest<T = any>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${HEYQO_BASE_URL}${path}`, { ...init, headers });
  } catch (error: any) {
    throw new HeyQOError('HeyQO est momentanément injoignable. Cette opération doit être vérifiée avant tout nouvel essai.', 503, undefined, 'unknown');
  }
  const payload = await readPayload(response);
  const method = String(init.method || 'GET').toUpperCase();
  if (response.status === 401 && retry && ['GET', 'HEAD'].includes(method)) {
    cachedToken = null;
    return heyqoRequest<T>(path, init, false);
  }
  if (!response.ok) {
    const confirmedRejected =
      response.status >= 400 &&
      response.status < 500 &&
      ![408, 409, 425, 429].includes(response.status);
    throw new HeyQOError(
      providerMessage(payload, response.status),
      response.status,
      payload,
      confirmedRejected ? 'confirmed_rejected' : 'unknown',
    );
  }
  return payload as T;
}

export function unwrapHeyQO<T = any>(payload: HeyQOResponse<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as any) && (payload as any).data !== undefined) {
    return (payload as HeyQOResponse<T>).data as T;
  }
  return payload as T;
}

export function sanitizeHeyQOCard(input: any): Record<string, unknown> {
  const source = input?.card || input || {};
  const info = source?.info && typeof source.info === 'object' ? source.info : {};
  const normalized = { ...source, ...info };
  const output: Record<string, unknown> = {};
  const allowedKeys = new Set([
    'id', 'local_id', 'customer_id', 'status', 'state', 'brand', 'currency',
    'last4', 'last_four', 'masked_pan', 'masked_number', 'cardholder',
    'cardholder_name', 'name_on_card', 'balance', 'available_balance', 'limit', 'monthly_limit',
    'monthly_spent', 'amount', 'created_at', 'updated_at', 'activated_at', 'frozen_at',
  ]);
  for (const [key, value] of Object.entries(normalized)) {
    if (!allowedKeys.has(key)) continue;
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) output[key] = value;
  }
  if (!output.id && output.local_id !== undefined && output.local_id !== null) output.id = String(output.local_id);
  return output;
}

export function extractCardList(payload: any): any[] {
  const data = unwrapHeyQO<any>(payload);
  if (Array.isArray(data)) return data;
  return (data?.cards || data?.items || data?.results || payload?.cards || []) as any[];
}

export function extractCard(payload: any): any {
  const data = unwrapHeyQO<any>(payload);
  if (data?.card) return data.card;
  return data;
}

export function extractCustomer(payload: any): any {
  const data = unwrapHeyQO<any>(payload);
  if (data?.customer) return data.customer;
  return data;
}

export function webhookDigest(rawBody: Buffer): string {
  return createHash('sha256').update(rawBody).digest('hex');
}