import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type express from 'express';

type Counter = { count: number; resetAt: number };
type RateLimitOptions = {
  name: string;
  windowMs: number;
  max: number;
  key?: (req: express.Request, res: express.Response) => string;
};

const memoryCounters = new Map<string, Counter>();
const memoryIdempotency = new Map<string, number>();
const MAX_MEMORY_ENTRIES = 20_000;
let redis: any | null = null;
let redisUnavailable = false;

function getRedis(): any | null {
  if (redis || redisUnavailable || !process.env.REDIS_URL) return redis;
  try {
    const require = createRequire(import.meta.url);
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redis.on('error', (error: any) => {
      console.error('[RateLimit] Redis error:', error?.message || error);
    });
    return redis;
  } catch (error: any) {
    redisUnavailable = true;
    console.error('[RateLimit] Redis unavailable; using bounded memory counters:', error?.message || error);
    return null;
  }
}

function requestIp(req: express.Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function sessionIdentity(req: express.Request, res: express.Response): string {
  const locals = res.locals;
  return String(
    locals.clientSession?.clientId ||
    locals.agentSession?.agentId ||
    locals.affiliateSession?.affiliateId ||
    locals.adminSession?.adminId ||
    `ip:${requestIp(req)}`,
  );
}

function cleanupMemory(now: number): void {
  for (const [key, value] of memoryCounters) {
    if (value.resetAt <= now) memoryCounters.delete(key);
  }
  for (const [key, expiresAt] of memoryIdempotency) {
    if (expiresAt <= now) memoryIdempotency.delete(key);
  }
  while (memoryIdempotency.size > MAX_MEMORY_ENTRIES) {
    const firstKey = memoryIdempotency.keys().next().value;
    if (!firstKey) break;
    memoryIdempotency.delete(firstKey);
  }
  if (memoryCounters.size <= MAX_MEMORY_ENTRIES) return;
  const oldest = [...memoryCounters.entries()]
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, memoryCounters.size - MAX_MEMORY_ENTRIES);
  for (const [key] of oldest) memoryCounters.delete(key);
}

async function consume(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
  const now = Date.now();
  const client = getRedis();
  if (client) {
    try {
      if (client.status === 'wait') await client.connect();
      const redisKey = `solutionpam:ratelimit:${key}`;
      const result = await client.multi()
        .incr(redisKey)
        .pexpire(redisKey, windowMs, 'NX')
        .pttl(redisKey)
        .exec();
      const count = Number(result?.[0]?.[1] || 0);
      const ttl = Math.max(1, Number(result?.[2]?.[1] || windowMs));
      return { count, resetAt: now + ttl };
    } catch (error: any) {
      console.error('[RateLimit] Redis counter failed; using memory fallback:', error?.message || error);
    }
  }

  cleanupMemory(now);
  const current = memoryCounters.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    memoryCounters.set(key, next);
    return next;
  }
  current.count += 1;
  return current;
}

export function createRateLimiter(options: RateLimitOptions): express.RequestHandler {
  return async (req, res, next) => {
    try {
      const identity = options.key ? options.key(req, res) : requestIp(req);
      const result = await consume(`${options.name}:${identity}`, options.windowMs);
      const remaining = Math.max(0, options.max - result.count);
      res.setHeader('X-RateLimit-Limit', String(options.max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
      if (result.count > options.max) {
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Trop de demandes. Veuillez patienter avant de réessayer.',
          retryAfter,
        });
      }
      next();
    } catch (error) {
      console.error('[RateLimit] unexpected failure:', error);
      return next();
    }
  };
}

export const apiRateLimiter = createRateLimiter({
  name: 'api',
  windowMs: 60_000,
  max: 240,
});

export const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 15 * 60_000,
  max: 12,
});

export const twoFactorRateLimiter = createRateLimiter({
  name: '2fa',
  windowMs: 5 * 60_000,
  max: 8,
});

export const financialRateLimiter = createRateLimiter({
  name: 'financial',
  windowMs: 60_000,
  max: 20,
  key: (req, res) => `${requestIp(req)}:${sessionIdentity(req, res)}`,
});

export const aiRateLimiter = createRateLimiter({
  name: 'ai',
  windowMs: 60_000,
  max: 10,
  key: (req, res) => sessionIdentity(req, res),
});

export const sseRateLimiter = createRateLimiter({
  name: 'sse',
  windowMs: 10 * 60_000,
  max: 10,
  key: (req, res) => sessionIdentity(req, res),
});

export function idempotencyGuard(windowMs = 10 * 60_000): express.RequestHandler {
  return async (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const suppliedKey = String(req.get('Idempotency-Key') || req.body?.idempotencyKey || '').trim();
    const automaticKey = createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');
    const rawKey = suppliedKey || automaticKey;
    if (!/^[A-Za-z0-9:_-]{16,128}$/.test(rawKey)) {
      return res.status(400).json({ error: 'Clé d’idempotence invalide.' });
    }
    const identity = sessionIdentity(req, res);
    const endpointPath = `${req.baseUrl}${req.path}` || req.originalUrl.split('?')[0];
    const digest = createHash('sha256').update(`${req.method}:${endpointPath}:${identity}:${rawKey}`).digest('hex');
    res.locals.financialOperationId = digest;
    const now = Date.now();
    const ttl = suppliedKey ? windowMs : 5_000;
    const client = getRedis();
    if (client) {
      try {
        if (client.status === 'wait') await client.connect();
        const accepted = await client.set(`solutionpam:idempotency:${digest}`, '1', 'PX', ttl, 'NX');
        if (accepted !== 'OK') {
          res.setHeader('Idempotency-Status', 'duplicate');
          return res.status(409).json({ error: 'Cette demande a déjà été reçue. Ne la soumettez pas une seconde fois.' });
        }
        res.setHeader('Idempotency-Status', suppliedKey ? 'accepted' : 'automatic');
        return next();
      } catch (error: any) {
        console.error('[Idempotency] Redis reservation failed; using memory fallback:', error?.message || error);
      }
    }
    cleanupMemory(now);
    if (memoryIdempotency.has(digest)) {
      res.setHeader('Idempotency-Status', 'duplicate');
      return res.status(409).json({ error: 'Cette demande a déjà été reçue. Ne la soumettez pas une seconde fois.' });
    }
    memoryIdempotency.set(digest, now + ttl);
    if (memoryIdempotency.size > MAX_MEMORY_ENTRIES) cleanupMemory(now);
    res.setHeader('Idempotency-Status', suppliedKey ? 'accepted' : 'automatic');
    next();
  };
}