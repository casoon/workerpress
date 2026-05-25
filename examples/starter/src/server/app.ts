import { createCloudflarePlatform } from '@workerpress/cloudflare';
import type { Platform } from '@workerpress/core';
import { Hono } from 'hono';

/**
 * Hono-App, gemountet unter /api/* durch Astro (siehe pages/api/[...path].ts).
 * Eine Worker: Astro besitzt das UI, Hono besitzt /api/* (ARCHITECTURE §2).
 * Oberflächen: /api/content/* (read-only, gecacht) und /api/internal/* (Vollzugriff).
 *
 * Domänen-Code greift nur über `c.var.platform` zu, nie direkt auf env.DB & Co.
 */

type Bindings = Env;
type Variables = { platform: Platform };
type AppEnv = { Bindings: Bindings; Variables: Variables };

const content = new Hono<AppEnv>().get('/health', (c) => c.json({ ok: true, surface: 'content' }));

const internal = new Hono<AppEnv>().get('/health', (c) =>
  c.json({ ok: true, surface: 'internal' }),
);

export const app = new Hono<AppEnv>();

// Bootstrap: Platform an genau einer Stelle aus env + executionCtx konstruieren.
app.use('*', async (c, next) => {
  c.set('platform', createCloudflarePlatform(c.env, c.executionCtx, { mediaBaseUrl: '/media' }));
  await next();
});

app.get('/api/health', (c) => {
  // Nachweis, dass env (Bindings) und executionCtx.waitUntil Hono erreichen.
  let waitUntil = false;
  try {
    c.executionCtx.waitUntil(Promise.resolve());
    waitUntil = true;
  } catch {
    waitUntil = false;
  }
  return c.json({
    ok: true,
    platform: Boolean(c.var.platform),
    bindings: {
      DB: Boolean(c.env.DB),
      MEDIA: Boolean(c.env.MEDIA),
      CACHE: Boolean(c.env.CACHE),
    },
    waitUntil,
  });
});

app.route('/api/content', content);
app.route('/api/internal', internal);

export type AppType = typeof app;
