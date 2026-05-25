import { Hono } from 'hono';

/**
 * Hono-App, gemountet unter /api/* durch Astro (siehe pages/api/[...path].ts).
 * Eine Worker: Astro besitzt das UI, Hono besitzt /api/* (ARCHITECTURE §2).
 * Oberflächen: /api/content/* (read-only, gecacht) und /api/internal/* (Vollzugriff).
 *
 * Grundgerüst: Collection-Routes werden von @workerpress/core generiert und hier
 * gemountet. Vorerst Health-Endpoints.
 */

type Bindings = Env;

const content = new Hono<{ Bindings: Bindings }>().get('/health', (c) =>
  c.json({ ok: true, surface: 'content' }),
);

const internal = new Hono<{ Bindings: Bindings }>().get('/health', (c) =>
  c.json({ ok: true, surface: 'internal' }),
);

export const app = new Hono<{ Bindings: Bindings }>()
  .get('/api/health', (c) => {
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
      bindings: {
        DB: Boolean(c.env.DB),
        MEDIA: Boolean(c.env.MEDIA),
        CACHE: Boolean(c.env.CACHE),
      },
      waitUntil,
    });
  })
  .route('/api/content', content)
  .route('/api/internal', internal);

export type AppType = typeof app;
