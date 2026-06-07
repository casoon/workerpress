import { defineMiddleware } from 'astro:middleware';
import { resolveUser } from './server/auth.js';

/** Schützt /admin-Seiten; /api/* schützen Policies in Hono. */
export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.url.pathname.startsWith('/admin')) {
    const user = await resolveUser(ctx.request);
    if (!user) return ctx.redirect('/');
    ctx.locals.user = user;
  }
  return next();
});
