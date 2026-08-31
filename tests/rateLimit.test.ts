import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { createRateLimiter, idempotencyGuard } from '../src/api/rateLimit.ts';

async function withServer(
  configure: (app: express.Express) => void,
  run: (baseUrl: string) => Promise<void>,
) {
  delete process.env.REDIS_URL;
  const app = express();
  app.use(express.json());
  configure(app);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not open a TCP port.');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('returns 429 with retry headers after the configured limit', async () => {
  await withServer(
    (app) => {
      app.get('/limited', createRateLimiter({ name: `test-${Date.now()}`, windowMs: 2_000, max: 2 }), (_req, res) => {
        res.json({ ok: true });
      });
    },
    async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/limited`)).status, 200);
      assert.equal((await fetch(`${baseUrl}/limited`)).status, 200);
      const blocked = await fetch(`${baseUrl}/limited`);
      assert.equal(blocked.status, 429);
      assert.equal(blocked.headers.get('x-ratelimit-remaining'), '0');
      assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    },
  );
});

test('allows requests again after the window resets', async () => {
  await withServer(
    (app) => {
      app.get('/reset', createRateLimiter({ name: `reset-${Date.now()}`, windowMs: 40, max: 1 }), (_req, res) => {
        res.sendStatus(204);
      });
    },
    async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/reset`)).status, 204);
      assert.equal((await fetch(`${baseUrl}/reset`)).status, 429);
      await new Promise((resolve) => setTimeout(resolve, 60));
      assert.equal((await fetch(`${baseUrl}/reset`)).status, 204);
    },
  );
});

test('blocks repeated financial submissions with the same idempotency key', async () => {
  await withServer(
    (app) => {
      app.post('/financial', idempotencyGuard(), (_req, res) => res.status(201).json({ created: true }));
    },
    async (baseUrl) => {
      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'test-financial-request-0001' },
        body: JSON.stringify({ amount: 10 }),
      };
      assert.equal((await fetch(`${baseUrl}/financial`, options)).status, 201);
      const duplicate = await fetch(`${baseUrl}/financial`, options);
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.headers.get('idempotency-status'), 'duplicate');
    },
  );
});

test('blocks rapid identical submissions even without an explicit key', async () => {
  await withServer(
    (app) => {
      app.post('/automatic', idempotencyGuard(), (_req, res) => res.status(201).json({ created: true }));
    },
    async (baseUrl) => {
      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: 25, destination: 'wallet' }),
      };
      assert.equal((await fetch(`${baseUrl}/automatic`, options)).status, 201);
      assert.equal((await fetch(`${baseUrl}/automatic`, options)).status, 409);
    },
  );
});

test('never applies idempotency blocking to repeated reads', async () => {
  await withServer(
    (app) => {
      app.get('/financial-status', idempotencyGuard(), (_req, res) => res.json({ status: 'pending' }));
    },
    async (baseUrl) => {
      assert.equal((await fetch(`${baseUrl}/financial-status`)).status, 200);
      assert.equal((await fetch(`${baseUrl}/financial-status`)).status, 200);
    },
  );
});

test('scopes mounted idempotency guards to the full endpoint path', async () => {
  await withServer(
    (app) => {
      const guard = idempotencyGuard();
      app.use('/api/pay', guard);
      app.use('/api/refund', guard);
      app.post('/api/pay', (_req, res) => res.status(201).json({ accepted: true }));
      app.post('/api/refund', (_req, res) => res.status(201).json({ accepted: true }));
    },
    async (baseUrl) => {
      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'shared-request-key-000001' },
        body: JSON.stringify({ amount: 50 }),
      };
      assert.equal((await fetch(`${baseUrl}/api/pay`, options)).status, 201);
      assert.equal((await fetch(`${baseUrl}/api/refund`, options)).status, 201);
      assert.equal((await fetch(`${baseUrl}/api/pay`, options)).status, 409);
    },
  );
});