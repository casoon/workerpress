import { createCloudflarePlatform } from '@workerpress/cloudflare';
import {
  type AuthUser,
  contentRoutes,
  internalRoutes,
  openApiDocument,
  type Platform,
  searchableFields,
} from '@workerpress/core';
import { Hono } from 'hono';
import blog from '../../collections/blog.js';
import pages from '../../collections/pages.js';
import { ACCESS_TEAM_DOMAIN, resolveUser } from './auth.js';
import { mediaRoutes } from './routes/internal/media.js';
import { notesRoutes } from './routes/internal/notes.js';
import { smokeRoutes } from './routes/internal/smoke.js';

/**
 * Hono-App, gemountet unter /api/* durch Astro (siehe pages/api/[...path].ts).
 * Eine Worker: Astro besitzt das UI, Hono besitzt /api/* (ARCHITECTURE §2).
 * Oberflächen: /api/content/* (read-only, gecacht) und /api/internal/* (Vollzugriff).
 *
 * Domänen-Code greift nur über `c.var.platform` zu, nie direkt auf env.DB & Co.
 * Routen werden gechaint, damit `AppType` für den hc-RPC-Client typsicher bleibt.
 */

type Bindings = Env;
type Variables = { platform: Platform; user?: AuthUser };
type AppEnv = { Bindings: Bindings; Variables: Variables };

// Content-API (read-only, nur published) und Internal-API (Vollzugriff) werden
// generisch aus den Collection-Definitionen generiert (ARCHITECTURE §10).
const content = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true, surface: 'content' }))
  .route('/blog', contentRoutes(blog))
  .route('/pages', contentRoutes(pages));

const internal = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true, surface: 'internal' }))
  .route('/notes', notesRoutes)
  .route('/smoke', smokeRoutes)
  .route('/media', mediaRoutes)
  .route('/content/blog', internalRoutes(blog))
  .route('/content/pages', internalRoutes(pages));

export const app = new Hono<AppEnv>()
  // Bootstrap: Platform an genau einer Stelle aus env + executionCtx konstruieren.
  .use('*', async (c, next) => {
    c.set(
      'platform',
      createCloudflarePlatform(c.env, c.executionCtx, {
        mediaBaseUrl: '/media',
        searchableFieldsByCollection: {
          blog: searchableFields(blog),
          pages: searchableFields(pages),
        },
        accessTeamDomain: ACCESS_TEAM_DOMAIN,
      }),
    );
    const user = await resolveUser(c.req.raw);
    if (user) c.set('user', user);
    await next();
  })
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
      platform: Boolean(c.var.platform),
      bindings: {
        DB: Boolean(c.env.DB),
        MEDIA: Boolean(c.env.MEDIA),
        CACHE: Boolean(c.env.CACHE),
      },
      waitUntil,
    });
  })
  .get('/api/docs', (c) =>
    c.json(openApiDocument([blog, pages], { title: 'WorkerPress Starter API', version: '0.0.0' })),
  )
  .route('/api/content', content)
  .route('/api/internal', internal);

export type AppType = typeof app;
