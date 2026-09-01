import express from 'express';
import apiRouter from '../src/api/router.ts';

const app = express();

// Vercel must not consume the request before Express sees it: HeyQO signs the
// exact webhook bytes. Express then parses the JSON and keeps a private copy
// for HMAC verification. The same 18 MiB limit is used by the Replit server
// because a KYC submission can contain several temporary base64 images.
export const config = {
  api: {
    bodyParser: false,
  },
};

app.use(express.json({
  limit: '18mb',
  verify: (req, _res, buffer) => {
    (req as any).rawBody = Buffer.from(buffer);
  },
}));

app.use((req, res, next) => {
  const allowedOrigins = new Set(
    [
      process.env.APP_URL,
      process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`,
      // Vercel injects these automatically per-deployment — allowlisting them means
      // the site's own frontend can always call its own API, on production, on the
      // stable branch alias, and on every unique preview-deployment URL, without
      // hand-maintaining APP_URL for each one.
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
      process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5000', 'http://localhost:5173', 'http://127.0.0.1:5000', 'http://127.0.0.1:5173'] : []),
    ]
      .filter(Boolean)
      .map((origin) => String(origin).replace(/\/$/, '')),
  );
  const origin = req.headers.origin;
  if (origin) {
    if (!allowedOrigins.has(origin.replace(/\/$/, ''))) {
      return res.status(403).json({ error: 'Origine non autorisée.' });
    }
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: wss:;");
  if (process.env.NODE_ENV === 'production') {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(apiRouter);

export default app;
