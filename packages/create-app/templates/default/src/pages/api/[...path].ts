import type { APIRoute } from 'astro';
import { app } from '../../server/app.js';

export const prerender = false;

/** Reicht alle /api/*-Requests an die Hono-App weiter (ein Worker). */
export const ALL: APIRoute = (ctx) =>
  app.fetch(ctx.request, ctx.locals.runtime.env, ctx.locals.runtime.ctx);
