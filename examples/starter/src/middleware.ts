import { defineMiddleware } from 'astro:middleware';
import { resolveUser } from './server/auth.js';

/**
 * Schützt /admin-Pages. /api/*-Endpunkte werden in Hono (über `c.var.user` +
 * Collection-Policies) geschützt; siehe ARCHITECTURE §2 / M1-7+M1-8.
 */
export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.url.pathname.startsWith('/admin')) {
    const user = await resolveUser(ctx.request);
    if (!user) return ctx.redirect('/login');
    ctx.locals.user = user;
  }
  return next();
});
