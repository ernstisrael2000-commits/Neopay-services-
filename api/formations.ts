import { createSign } from 'crypto';

const DEFAULT_PROJECT = 'gen-lang-client-0739219145';
const DEFAULT_DB_ID = 'ai-studio-283d6370-7e1a-484a-aed2-4d5b3071d1e2';

function parseValue(val: any): any {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) {
    const ms = new Date(val.timestampValue).getTime();
    return { _seconds: Math.floor(ms / 1000), _nanoseconds: (ms % 1000) * 1e6 };
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseValue);
  }
  if ('mapValue' in val) {
    return parseFields(val.mapValue.fields || {});
  }
  return null;
}

function parseFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = parseValue(v);
  }
  return out;
}

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${sign.sign(sa.private_key, 'base64url')}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token, error } = await r.json() as any;
  if (error) throw new Error(`OAuth: ${error}`);
  return access_token;
}

export default async function handler(req: any, res: any) {
  const origin = req.headers.origin;
  const allowedOrigins = new Set(
    [
      process.env.APP_URL,
      process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`,
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:5173', 'http://127.0.0.1:5000', 'http://127.0.0.1:5173'] : []),
    ]
      .filter(Boolean)
      .map((value) => String(value).replace(/\/$/, '')),
  );
  if (origin && !allowedOrigins.has(String(origin).replace(/\/$/, ''))) {
    return res.status(403).json({ error: 'Origine non autorisée.' });
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawSa) {
      return res.status(200).json({ formations: [], unavailable: true });
    }
    let raw = rawSa.trim();
    // Support base64-encoded JSON (Vercel / Railway workaround)
    if (!raw.startsWith('{')) {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8').trim();
        if (decoded.startsWith('{')) raw = decoded;
      } catch {}
    }
    if (!raw.startsWith('{')) raw = '{' + raw;
    const sa = JSON.parse(raw);
    if (sa.private_key) {
      sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    }

    const token = await getAccessToken(sa);
    const project = process.env.FIREBASE_PROJECT_ID || sa.project_id || DEFAULT_PROJECT;
    const databaseId = process.env.FIRESTORE_DB_ID || DEFAULT_DB_ID;

    const qRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/${databaseId}/documents:runQuery`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'formations' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'published' },
                op: 'EQUAL',
                value: { booleanValue: true },
              },
            },
            orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          },
        }),
      }
    );

    if (!qRes.ok) {
      console.error('[formations standalone] Firestore request failed:', qRes.status);
      return res.status(200).json({ formations: [], unavailable: true });
    }

    const rows: any[] = await qRes.json();
    const formations = rows
      .filter((row) => row.document)
      .map((row) => {
        const id = (row.document.name as string).split('/').pop();
        return { id, ...parseFields(row.document.fields || {}) };
      });

    return res.status(200).json({ formations });
  } catch (e: any) {
    console.error('[formations standalone]', e?.message || e);
    return res.status(200).json({ formations: [], unavailable: true });
  }
}
