import express from "express";
import { createServer as createHttpServer } from "http";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import apiRouter from './src/api/router.ts';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '5000', 10);

  // Raw body capture for MonCash webhook HMAC verification (must be before express.json())
  app.use('/api/webhooks/moncash', (req: any, _res: any, next: any) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { raw += chunk; });
    req.on('end', () => {
      req.rawBody = raw;
      try { req.body = JSON.parse(raw); } catch { req.body = {}; }
      next();
    });
  });

  app.use(express.json({ limit: '2mb' }));

  // ── Security headers ────────────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-secret');
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
