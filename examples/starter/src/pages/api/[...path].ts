import type { APIRoute } from 'astro';
import { app } from '../../server/app.js';

export const prerender = false;

const handler: APIRoute = (ctx) =>
  app.fetch(ctx.request, ctx.locals.runtime.env, ctx.locals.runtime.ctx);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
