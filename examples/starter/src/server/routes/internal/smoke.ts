import type { Platform } from '@workerpress/core';
import { Hono } from 'hono';

type Env = { Variables: { platform: Platform } };

const COUNTER_KEY = 'smoke:counter';

/**
 * Smoke-Pfade für die tragenden Bindings — ausschließlich über `platform.*`,
 * nie direkt auf R2/KV (ARCHITECTURE ADR 8).
 */
export const smokeRoutes = new Hono<Env>()
  // R2: Datei hochladen.
  .put('/media/:key', async (c) => {
    const key = c.req.param('key');
    const data = await c.req.arrayBuffer();
    await c.var.platform.storage.put(key, data);
    return c.json({ key, url: c.var.platform.storage.url(key) }, 201);
  })
  // R2: Datei ausliefern.
  .get('/media/:key', async (c) => {
    const stream = await c.var.platform.storage.get(c.req.param('key'));
    if (!stream) return c.json({ error: 'not found' }, 404);
    return new Response(stream);
  })
  // KV: Counter erhöhen (mit TTL).
  .post('/counter', async (c) => {
    const kv = c.var.platform.kv;
    const next = Number((await kv.get(COUNTER_KEY)) ?? '0') + 1;
    await kv.put(COUNTER_KEY, String(next), { ttl: 3600 });
    return c.json({ counter: next });
  })
  // KV: aktuellen Counter lesen.
  .get('/counter', async (c) => {
    return c.json({ counter: Number((await c.var.platform.kv.get(COUNTER_KEY)) ?? '0') });
  });
