/**
 * REST-Generator (M1-4): zwei getrennte Oberflächen pro Collection.
 * - internalRoutes: Vollzugriff (CRUD), gemountet unter /api/internal/content/<collection>.
 * - contentRoutes: read-only, nur `published`, gemountet unter /api/content/<collection>.
 * Routen bleiben dünn: Zod-Validierung -> Repository (keine Query in der Route).
 */

import { type Context, Hono } from 'hono';
import type { CollectionConfig } from '../collections/index.js';
import { collectionRepository, type ListOptions } from '../db/repository.js';
import type { Platform } from '../platform/index.js';
import { collectionSchemas } from '../schema/zod.js';

type Env = { Variables: { platform: Platform } };

function parseListQuery(c: Context<Env>): ListOptions {
  const { limit, offset, orderBy, order, ...where } = c.req.query();
  return {
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
    orderBy,
    order: order === 'desc' ? 'desc' : 'asc',
    where: Object.keys(where).length > 0 ? where : undefined,
  };
}

export function internalRoutes(collection: CollectionConfig) {
  const schemas = collectionSchemas(collection);
  const repo = (c: Context<Env>) => collectionRepository(c.var.platform.db, collection);
  return new Hono<Env>()
    .get('/', async (c) => c.json(await repo(c).list(parseListQuery(c))))
    .get('/:id', async (c) => {
      const record = await repo(c).get(c.req.param('id'));
      return record ? c.json(record) : c.json({ error: 'not found' }, 404);
    })
    .post('/', async (c) => {
      const parsed = schemas.insert.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      return c.json(await repo(c).create(parsed.data as Record<string, unknown>), 201);
    })
    .put('/:id', async (c) => {
      const parsed = schemas.update.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const record = await repo(c).update(
        c.req.param('id'),
        parsed.data as Record<string, unknown>,
      );
      return record ? c.json(record) : c.json({ error: 'not found' }, 404);
    })
    .delete('/:id', async (c) => {
      const ok = await repo(c).remove(c.req.param('id'));
      return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
    });
}

export function contentRoutes(collection: CollectionConfig) {
  const repo = (c: Context<Env>) => collectionRepository(c.var.platform.db, collection);
  return new Hono<Env>()
    .get('/', async (c) =>
      c.json(await repo(c).list({ ...parseListQuery(c), publishedOnly: true })),
    )
    .get('/:id', async (c) => {
      const record = await repo(c).get(c.req.param('id'), { publishedOnly: true });
      return record ? c.json(record) : c.json({ error: 'not found' }, 404);
    });
}
