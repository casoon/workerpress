import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { app } from '../../server/app.js';

export const prerender = false;

const handler: APIRoute = (ctx) => app.fetch(ctx.request, env, ctx.locals.cfContext);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
