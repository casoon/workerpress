import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getSession } from './server/auth.js';

/** Schützt /admin-Pages. API-Endpoints werden in Hono geschützt (siehe ARCHITECTURE §2). */
export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.url.pathname.startsWith('/admin')) {
    const session = await getSession(ctx.request, env);
    if (!session) return ctx.redirect('/login');
    ctx.locals.user = session.user;
  }
  return next();
});
