/**
 * REST-Generator (M1-4): zwei getrennte Oberflächen pro Collection.
 * - internalRoutes: Vollzugriff (CRUD) + /search, gemountet unter /api/internal/content/<collection>.
 * - contentRoutes: read-only, nur `published`, gemountet unter /api/content/<collection>.
 * Routen bleiben dünn: Zod-Validierung -> Repository (keine Query in der Route).
 *
 * Auto-Indexing (M1-14): wird `searchable: true` an Feldern verwendet, indiziert
 * der Adapter beim Schreiben fire-and-forget über `platform.defer`.
 */

import { type Context, Hono } from 'hono';
import type { CollectionConfig } from '../collections/index.js';
import { searchableFields } from '../db/fts5.js';
import { collectionRepository, type ListOptions } from '../db/repository.js';
import type { AuthUser, Platform, SearchableDoc } from '../platform/index.js';
import { collectionSchemas } from '../schema/zod.js';

type Env = { Variables: { platform: Platform; user?: AuthUser } };

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

function toSearchableDoc(record: Record<string, unknown>, fields: string[]): SearchableDoc {
  const doc: SearchableDoc = {};
  for (const f of fields) {
    const v = record[f];
    doc[f] =
      typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null
        ? v
        : v == null
          ? null
          : JSON.stringify(v);
  }
  return doc;
}

export function internalRoutes(collection: CollectionConfig) {
  const schemas = collectionSchemas(collection);
  const fields = searchableFields(collection);
  const repo = (c: Context<Env>) => collectionRepository(c.var.platform.db, collection);

  async function authorize(
    c: Context<Env>,
    op: 'read' | 'write',
    doc?: Record<string, unknown>,
  ): Promise<{ allowed: true } | { allowed: false; policy: string }> {
    const policy = op === 'read' ? collection.access?.read : collection.access?.write;
    if (!policy) return { allowed: true };
    const ok = Boolean(await policy.check({ user: c.var.user, doc }));
    return ok ? { allowed: true } : { allowed: false, policy: policy.name };
  }

  function indexAfter(c: Context<Env>, record: Record<string, unknown>): void {
    if (fields.length === 0) return;
    const id = typeof record.id === 'string' ? record.id : undefined;
    if (!id) return;
    c.var.platform.defer(() =>
      c.var.platform.search.index(collection.name, id, toSearchableDoc(record, fields)),
    );
  }

  function removeAfter(c: Context<Env>, id: string): void {
    if (fields.length === 0) return;
    c.var.platform.defer(() => c.var.platform.search.remove(collection.name, id));
  }

  return new Hono<Env>()
    .get('/', async (c) => {
      const rows = await repo(c).list(parseListQuery(c));
      const readPolicy = collection.access?.read;
      if (!readPolicy) return c.json(rows);
      const filtered: typeof rows = [];
      for (const row of rows) {
        if (await readPolicy.check({ user: c.var.user, doc: row })) filtered.push(row);
      }
      return c.json(filtered);
    })
    .get('/search', async (c) => {
      const q = c.req.query('q');
      if (!q) return c.json({ error: 'missing q' }, 400);
      const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
      const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;
      return c.json(await c.var.platform.search.query(collection.name, q, { limit, offset }));
    })
    .get('/:id', async (c) => {
      const record = await repo(c).get(c.req.param('id'));
      if (!record) return c.json({ error: 'not found' }, 404);
      // Auf 404 zu mappen, vermeidet, dass die Existenz des Datensatzes geleakt wird.
      const auth = await authorize(c, 'read', record);
      if (!auth.allowed) return c.json({ error: 'not found' }, 404);
      return c.json(record);
    })
    .post('/', async (c) => {
      const parsed = schemas.insert.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const auth = await authorize(c, 'write');
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      const record = await repo(c).create(parsed.data as Record<string, unknown>);
      indexAfter(c, record);
      return c.json(record, 201);
    })
    .put('/:id', async (c) => {
      const parsed = schemas.update.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const existing = await repo(c).get(c.req.param('id'));
      if (!existing) return c.json({ error: 'not found' }, 404);
      const auth = await authorize(c, 'write', existing);
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      const record = await repo(c).update(
        c.req.param('id'),
        parsed.data as Record<string, unknown>,
      );
      if (record) indexAfter(c, record);
      return record ? c.json(record) : c.json({ error: 'not found' }, 404);
    })
    .delete('/:id', async (c) => {
      const id = c.req.param('id');
      const existing = await repo(c).get(id);
      if (!existing) return c.json({ error: 'not found' }, 404);
      const auth = await authorize(c, 'write', existing);
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      const ok = await repo(c).remove(id);
      if (ok) removeAfter(c, id);
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
