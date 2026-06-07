import { createCloudflarePlatform } from '@workerpress/cloudflare';
import {
  type AuthUser,
  buildRegistry,
  collectSubscribers,
  contentRoutes,
  internalRoutes,
  openApiDocument,
  type Platform,
  resolvePlugins,
  searchableFields,
} from '@workerpress/core';
import { Hono } from 'hono';
import blog from '../../collections/blog.js';
import pages from '../../collections/pages.js';
import { plugins } from '../../plugins/index.js';
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

// Plugin-Registry (M2-1): in Abhängigkeitsreihenfolge aufgelöst und automatisch
// gemountet. Plugin-Collections erhalten dieselben Content-/Internal-Routen wie
// First-Party-Collections; eigene Plugin-Routen landen unter /internal/plugins.
const resolved = resolvePlugins(plugins);
// Event-Subscriber (M2-3) aus den Plugin-`on`-Maps, einmalig gesammelt.
const eventSubscribers = collectSubscribers(resolved.plugins);
// Collection-Registry (M2-4): alle Collections, damit `?include=` Relationen
// über First-Party- und Plugin-Grenzen hinweg auflösen kann.
const allCollections = [blog, pages, ...resolved.collections];
const registry = buildRegistry(allCollections);
const routeOpts = { registry };

// Content-API (read-only, nur published) und Internal-API (Vollzugriff) werden
// generisch aus den Collection-Definitionen generiert (ARCHITECTURE §10).
const content = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true, surface: 'content' }))
  .route('/blog', contentRoutes(blog, routeOpts))
  .route('/pages', contentRoutes(pages, routeOpts));

const internal = new Hono<AppEnv>()
  .get('/health', (c) => c.json({ ok: true, surface: 'internal' }))
  .route('/notes', notesRoutes)
  .route('/smoke', smokeRoutes)
  .route('/media', mediaRoutes)
  .route('/content/blog', internalRoutes(blog, routeOpts))
  .route('/content/pages', internalRoutes(pages, routeOpts));

const pluginRoutes = new Hono<AppEnv>();
for (const plugin of resolved.plugins) plugin.routes?.(pluginRoutes);
internal.route('/plugins', pluginRoutes);
for (const collection of resolved.collections) {
  content.route(`/${collection.name}`, contentRoutes(collection, routeOpts));
  internal.route(`/content/${collection.name}`, internalRoutes(collection, routeOpts));
}

// FTS5-Felder pro Collection (First-Party + Plugins) für den Such-Adapter.
const searchableFieldsByCollection: Record<string, string[]> = {
  blog: searchableFields(blog),
  pages: searchableFields(pages),
};
for (const collection of resolved.collections) {
  searchableFieldsByCollection[collection.name] = searchableFields(collection);
}

export const app = new Hono<AppEnv>()
  // Bootstrap: Platform an genau einer Stelle aus env + executionCtx konstruieren.
  .use('*', async (c, next) => {
    c.set(
      'platform',
      createCloudflarePlatform(c.env, c.executionCtx, {
        mediaBaseUrl: '/media',
        searchableFieldsByCollection,
        accessTeamDomain: ACCESS_TEAM_DOMAIN,
        eventSubscribers,
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
    c.json(
      openApiDocument(allCollections, {
        title: 'WorkerPress Starter API',
        version: '0.0.0',
      }),
    ),
  )
  .route('/api/content', content)
  .route('/api/internal', internal);

export type AppType = typeof app;
