import express from "express";
import compression from "compression";
import { createServer as createHttpServer } from "http";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { readFileSync } from 'node:fs';
import { apiRateLimiter } from './src/api/rateLimit.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import apiRouter from './src/api/router.ts';
import { getCanonicalUrl, getSeoPage, getStructuredData, SEO_SITE_URL } from './src/lib/seo.ts';

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  for (const value of [process.env.APP_URL, process.env.REPLIT_DEV_DOMAIN && `https://${process.env.REPLIT_DEV_DOMAIN}`]) {
    if (value) origins.add(value.replace(/\/$/, ''));
  }
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5000');
    origins.add('http://127.0.0.1:5173');
  }
  return origins;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderSeoFallback(pathname: string): string {
  const page = getSeoPage(pathname);
  if (!page) return '';

  return `<noscript><main><header><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p></header><nav aria-label="Navigation Solution Pam"><a href="/">Accueil Solution Pam</a> | <a href="/produits">Produits et recharges</a> | <a href="/recharge-free-fire">Recharge Free Fire</a> | <a href="/abonnements">Abonnements</a> | <a href="/paiements">Paiements</a> | <a href="/services">Services</a> | <a href="/suivi-colis">Suivi de colis</a> | <a href="/expedition">Expédition</a> | <a href="/formations">Formations</a> | <a href="/a-propos">À propos</a> | <a href="/contact">Contact</a></nav></main></noscript>`;
}

function renderSeoDocument(template: string, pathname: string): string {
  const page = getSeoPage(pathname);
  const title = page?.title || 'Solutionpam';
  const description = page?.description || 'Services numériques et logistiques Solutionpam.';
  const canonical = page ? getCanonicalUrl(page.path) : SEO_SITE_URL;
  const robots = page ? 'index, follow' : 'noindex, nofollow';
  const schema = JSON.stringify(getStructuredData()).replace(/</g, '\\u003c');

  return template
    .replace(/<title data-seo-title>.*?<\/title>/s, `<title data-seo-title>${escapeHtml(title)}</title>`)
    .replace(/<meta data-seo-description name="description" content="[^"]*"\s*\/?>/, `<meta data-seo-description name="description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/, `<meta name="robots" content="${robots}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta data-seo-og-title property="og:title" content="[^"]*"\s*\/?>/, `<meta data-seo-og-title property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta data-seo-og-description property="og:description" content="[^"]*"\s*\/?>/, `<meta data-seo-og-description property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta data-seo-og-url property="og:url" content="[^"]*"\s*\/?>/, `<meta data-seo-og-url property="og:url" content="${canonical}" />`)
    .replace(/<meta data-seo-twitter-title name="twitter:title" content="[^"]*"\s*\/?>/, `<meta data-seo-twitter-title name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta data-seo-twitter-description name="twitter:description" content="[^"]*"\s*\/?>/, `<meta data-seo-twitter-description name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<script id="seo-structured-data" type="application\/ld\+json">.*?<\/script>/s, `<script id="seo-structured-data" type="application/ld+json">${schema}</script>`)
    .replace('<!-- seo-fallback -->', renderSeoFallback(pathname));
}

async function startServer() {
  const app = express();
  // Replit and the production edge each add one trusted proxy hop. This lets
  // Express expose the real client IP without trusting an arbitrary full chain.
  app.set('trust proxy', 1);
  const PORT = parseInt(process.env.PORT || '5000', 10);
  if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
    throw new Error('APP_URL doit être configuré en production pour appliquer la politique CORS.');
  }
  const corsOrigins = allowedOrigins();

  // ── Gzip compression for all responses ─────────────────────────────────────
  app.use(compression({ level: 6, threshold: 1024 }));

  app.use(express.json({
    // Full HeyQO KYC can contain up to three short-lived base64 JPG/PNG files.
    // The route validates each file at 4 MiB and never persists the payload.
    limit: '18mb',
    verify: (req, _res, buffer) => {
      // HeyQO signs the exact request bytes. Keep a private copy for webhook
      // verification without changing the parsed JSON used by other routes.
      (req as any).rawBody = Buffer.from(buffer);
    },
  }));

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    // Firebase Google Auth injects its official loader and uses an accounts iframe
    // during popup sign-in. Keep the policy restrictive while explicitly allowing
    // only those required Google/Firebase origins.
    // Course player embeds preview videos via Vimeo/YouTube iframes; allow those origins explicitly.
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com; frame-src 'self' https://heyqo.cash https://*.heyqo.cash https://accounts.google.com https://*.firebaseapp.com https://player.vimeo.com https://www.youtube.com https://www.youtube-nocookie.com; connect-src 'self' https: wss:;");
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') return next();
    const host = req.get('host')?.split(':')[0];
    const isInternalProbe = !host || host === 'localhost' || host === '127.0.0.1' || host.startsWith('169.254.');
    if (!isInternalProbe && host !== 'solutionpam.com') {
      return res.redirect(301, `${SEO_SITE_URL}${req.originalUrl}`);
    }
    next();
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      if (!corsOrigins.has(origin.replace(/\/$/, ''))) {
        return res.status(403).json({ error: 'Origine non autorisée.' });
      }
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/api', (req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

  // Global protection against request floods. More sensitive route groups add
  // tighter identity-aware limits inside the API router.
  app.use('/api', apiRateLimiter);

  app.use(apiRouter);

  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== "production") {
    const VITE_PORT = parseInt(process.env.VITE_PORT || '5173', 10);

    const { spawn } = await import('child_process');
    const viteProcess = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '0.0.0.0'], {
      stdio: 'inherit',
      env: { ...process.env },
      shell: true,
    });

    viteProcess.on('error', (err) => {
      console.error('[Vite] Failed to start:', err);
    });

    process.on('exit', () => viteProcess.kill());
    process.on('SIGTERM', () => { viteProcess.kill(); process.exit(0); });
    process.on('SIGINT', () => { viteProcess.kill(); process.exit(0); });

    // Wait until Vite is actually ready instead of a fixed delay
    const waitForVite = async (port: number, maxWaitMs = 15000) => {
      const deadline = Date.now() + maxWaitMs;
      while (Date.now() < deadline) {
        try {
          const r = await fetch(`http://localhost:${port}/`);
          if (r.status < 500) return;
        } catch {}
        await new Promise(res => setTimeout(res, 100));
      }
      console.warn('[Vite] Did not respond within timeout, proxying anyway');
    };
    await waitForVite(VITE_PORT);

    const { createProxyMiddleware } = await import('http-proxy-middleware') as any;
    app.use('/', createProxyMiddleware({
      target: `http://localhost:${VITE_PORT}`,
      changeOrigin: true,
      ws: true,
      on: {
        error: (_err: any, _req: any, res: any) => {
          if (res && typeof res.status === 'function') {
            res.status(502).send('Vite dev server not ready yet');
          }
        },
      },
    }));

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Vite dev server on http://localhost:${VITE_PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexPath = path.join(distPath, 'index.html');
    let indexTemplate: string | null = null;

    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));

    app.use(express.static(distPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.endsWith('sw.js')) {
          // Service workers must never be cached by the browser — always revalidate
          // so a new deployment is picked up immediately.
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Service-Worker-Allowed', '/');
        } else if (
          filePath.endsWith('.webmanifest') ||
          filePath.endsWith('robots.txt') ||
          filePath.endsWith('sitemap.xml')
        ) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
      },
    }));

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      indexTemplate ||= readFileSync(indexPath, 'utf8');
      res.type('html').send(renderSeoDocument(indexTemplate, _req.path));
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
