import { createCloudflarePlatform } from '@workerpress/cloudflare';
import {
  type AuthUser,
  buildRegistry,
  contentRoutes,
  internalRoutes,
  openApiDocument,
  type Platform,
} from '@workerpress/core';
import { Hono } from 'hono';
import blog from '../../collections/blog.js';
import { resolveUser } from './auth.js';

type AppEnv = { Bindings: Env; Variables: { platform: Platform; user?: AuthUser } };

const collections = [blog];
const registry = buildRegistry(collections);
const routeOpts = { registry, history: { versions: true, audit: true }, cache: { ttl: 300 } };

const content = new Hono<AppEnv>().route('/blog', contentRoutes(blog, routeOpts));
const internal = new Hono<AppEnv>().route('/content/blog', internalRoutes(blog, routeOpts));

export const app = new Hono<AppEnv>()
  .use('*', async (c, next) => {
    c.set('platform', createCloudflarePlatform(c.env, c.executionCtx, { mediaBaseUrl: '/media' }));
    const user = await resolveUser(c.req.raw);
    if (user) c.set('user', user);
    await next();
  })
  .get('/api/health', (c) => c.json({ ok: true }))
  .get('/api/docs', (c) =>
    c.json(openApiDocument(collections, { title: '__PROJECT_NAME__ API', version: '0.0.0' })),
  )
  .route('/api/content', content)
  .route('/api/internal', internal);

export type AppType = typeof app;
