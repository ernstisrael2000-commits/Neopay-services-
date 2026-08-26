// ─── Realtime event bus (SSE broadcast) ─────────────────────────────────────
//
// SSE connections are long-lived HTTP responses held open by a single server
// process/instance. On a traditional always-on server (Replit dev, Railway,
// Render), one process handles every request, so an in-memory Map from
// userId -> open connections is enough to broadcast an event.
//
// On serverless platforms (Vercel), each request can be routed to a
// different function instance with its own isolated memory. A notification
// triggered by request A (e.g. an admin approving a withdrawal) would never
// reach a connection held open by request B's instance if we only wrote to
// a local in-memory Map. To broadcast across instances we publish through
// Redis pub/sub when REDIS_URL is configured; every SSE-holding instance
// subscribes to the channels it cares about over one shared connection.
//
// When REDIS_URL is not set (e.g. local development), this module falls
// back to a pure in-memory bus with the exact same interface, so the app
// keeps working unmodified on single-process hosts.

import { createRequire } from 'node:module';

type MessageHandler = (message: string) => void;

interface EventBus {
  publish(channel: string, message: string): void;
  subscribe(channel: string, handler: MessageHandler): () => void;
}

// ── In-memory fallback (single process only) ─────────────────────────────────
class MemoryBus implements EventBus {
  private handlers = new Map<string, Set<MessageHandler>>();

  publish(channel: string, message: string): void {
    const set = this.handlers.get(channel);
    if (!set || set.size === 0) return;
    for (const handler of [...set]) {
      try { handler(message); } catch { /* ignore a single bad subscriber */ }
    }
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) this.handlers.set(channel, new Set());
    const set = this.handlers.get(channel)!;
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(channel);
    };
  }
}

// ── Redis-backed bus (works across serverless instances) ─────────────────────
class RedisBus implements EventBus {
  private pub: any;
  private sub: any;
  private localHandlers = new Map<string, Set<MessageHandler>>();
  private subscribedChannels = new Set<string>();

  constructor(redisUrl: string, IORedis: any) {
    const opts = { maxRetriesPerRequest: 3, lazyConnect: false };
    this.pub = new IORedis(redisUrl, opts);
    this.sub = new IORedis(redisUrl, opts);
    this.pub.on('error', (e: any) => console.error('[Realtime] Redis publisher error:', e?.message || e));
    this.sub.on('error', (e: any) => console.error('[Realtime] Redis subscriber error:', e?.message || e));
    this.sub.on('message', (channel: string, message: string) => {
      const set = this.localHandlers.get(channel);
      if (!set) return;
      for (const handler of [...set]) {
        try { handler(message); } catch { /* ignore a single bad subscriber */ }
      }
    });
  }

  publish(channel: string, message: string): void {
    this.pub.publish(channel, message).catch((e: any) =>
      console.error('[Realtime] Redis publish failed:', e?.message || e)
    );
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.localHandlers.has(channel)) this.localHandlers.set(channel, new Set());
    const set = this.localHandlers.get(channel)!;
    set.add(handler);
    if (!this.subscribedChannels.has(channel)) {
      this.subscribedChannels.add(channel);
      this.sub.subscribe(channel).catch((e: any) =>
        console.error('[Realtime] Redis subscribe failed:', e?.message || e)
      );
    }
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.localHandlers.delete(channel);
        this.subscribedChannels.delete(channel);
        this.sub.unsubscribe(channel).catch(() => {});
      }
    };
  }
}

let bus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (bus) return bus;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const _require = createRequire(import.meta.url);
      const IORedis = _require('ioredis');
      bus = new RedisBus(redisUrl, IORedis);
      console.log('[Realtime] Using Redis-backed event bus (cross-instance broadcast enabled)');
    } catch (e: any) {
      console.error('[Realtime] Failed to initialize Redis bus, falling back to in-memory:', e?.message || e);
      bus = new MemoryBus();
    }
  } else {
    bus = new MemoryBus();
    console.warn('[Realtime] REDIS_URL not set — using in-memory event bus. Real-time events will only reach ' +
      'clients connected to the same server instance. This is fine for a single always-on process (e.g. Replit) ' +
      'but will NOT reliably broadcast across multiple serverless instances (e.g. Vercel).');
  }
  return bus;
}
