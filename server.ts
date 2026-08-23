import express from "express";
import compression from "compression";
import { createServer as createHttpServer } from "http";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import apiRouter from './src/api/router.ts';

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

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '5000', 10);
  if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
    throw new Error('APP_URL doit être configuré en production pour appliquer la politique CORS.');
  }
  const corsOrigins = allowedOrigins();

  // ── Gzip compression for all responses ─────────────────────────────────────
  app.use(compression({ level: 6, threshold: 1024 }));

  app.use(express.json({ limit: '2mb' }));

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
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com; frame-src 'self' https://accounts.google.com https://*.firebaseapp.com; connect-src 'self' https: wss:;");
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/api', (req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });

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

    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
    }));

    app.use(express.static(distPath, {
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
      res.sendFile(path.join(distPath, 'index.html'));
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
