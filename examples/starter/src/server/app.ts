import { Hono } from 'hono';

/**
 * Hono-App, gemountet unter /api/* durch Astro (siehe pages/api/[...path].ts).
 * Zwei Oberflächen: /api/content/* (read-only, gecacht) und /api/internal/*
 * (Vollzugriff, kein Cache). Siehe ARCHITECTURE §10.
 *
 * Grundgerüst: die Collection-Routes werden von @workerpress/core generiert
 * und hier gemountet. Vorerst nur Health-Endpoints.
 */

// biome-ignore lint/complexity/noBannedTypes: Bindings werden vom Adapter typisiert
type Bindings = {};

const content = new Hono<{ Bindings: Bindings }>().get('/health', (c) =>
  c.json({ ok: true, surface: 'content' }),
);

const internal = new Hono<{ Bindings: Bindings }>().get('/health', (c) =>
  c.json({ ok: true, surface: 'internal' }),
);

export const app = new Hono<{ Bindings: Bindings }>()
  .route('/api/content', content)
  .route('/api/internal', internal);

export type AppType = typeof app;
