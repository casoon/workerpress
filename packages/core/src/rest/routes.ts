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
import { parseFindQuery } from '../db/query.js';
import { type CollectionRegistry, parseInclude, resolveIncludes } from '../db/relations.js';
import { collectionRepository } from '../db/repository.js';
import { runHooks } from '../hooks/index.js';
import type { AuthUser, Platform, SearchableDoc } from '../platform/index.js';
import { collectionSchemas } from '../schema/zod.js';

type Env = { Variables: { platform: Platform; user?: AuthUser } };

/** Optionen für die Routen-Generierung (Relation-Auflösung über die Registry). */
export interface RouteOptions {
  /** Alle Collections, damit `?include=` Relationen auflösen kann (M2-4). */
  registry?: CollectionRegistry;
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

export function internalRoutes(collection: CollectionConfig, routeOpts: RouteOptions = {}) {
  const schemas = collectionSchemas(collection);
  const fields = searchableFields(collection);
  const repo = (c: Context<Env>) => collectionRepository(c.var.platform.db, collection);
  const registry = routeOpts.registry;

  // Löst `?include=author,tags` auf den gegebenen Zeilen auf (M2-4), sofern eine
  // Registry vorhanden ist. Ohne Registry/Include bleiben die rohen IDs erhalten.
  async function withIncludes(
    c: Context<Env>,
    rows: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const include = parseInclude(c.req.query('include'));
    if (!registry || include.length === 0) return rows;
    return resolveIncludes(c.var.platform.db, collection, rows, include, registry);
  }

  async function filterByReadPolicy(
    c: Context<Env>,
    rows: Record<string, unknown>[],
    policy: NonNullable<NonNullable<CollectionConfig['access']>['read']>,
  ): Promise<Record<string, unknown>[]> {
    const filtered: Record<string, unknown>[] = [];
    for (const row of rows) {
      if (await policy.check({ user: c.var.user, doc: row })) filtered.push(row);
    }
    return filtered;
  }

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

  // Event-Bus (M2-3): nach erfolgreicher Schreiboperation feuern. `emit` kehrt
  // sofort zurück; die Zustellung läuft entkoppelt über `platform.events`.
  function emitWrite(
    c: Context<Env>,
    record: Record<string, unknown>,
    operation: 'create' | 'update',
  ): void {
    const id = typeof record.id === 'string' ? record.id : undefined;
    if (!id) return;
    const events = c.var.platform.events;
    if (operation === 'create') {
      events.emit('content.created', { collection: collection.name, id, doc: record });
    }
    if (record.status === 'published') {
      events.emit('content.published', { collection: collection.name, id, doc: record });
    }
  }

  // Lifecycle-Hooks (M2-2). `beforeChange` darf `doc` mutieren und abbrechen:
  // wirft ein Hook, antworten wir mit 422 (Rückgabe = fertige Response). Fehler
  // aus `afterChange` werden bewusst nicht abgefangen — fehleranfällige
  // Nacharbeit gehört in den Event-Bus (M2-3).
  async function beforeChange(
    c: Context<Env>,
    doc: Record<string, unknown>,
    operation: 'create' | 'update',
  ): Promise<Response | null> {
    try {
      await runHooks(collection.hooks?.beforeChange, {
        doc,
        user: c.var.user,
        collection: collection.name,
        operation,
      });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'hook rejected the request';
      return c.json({ error: message }, 422);
    }
  }

  async function afterChange(
    c: Context<Env>,
    doc: Record<string, unknown>,
    operation: 'create' | 'update',
  ): Promise<void> {
    await runHooks(collection.hooks?.afterChange, {
      doc,
      user: c.var.user,
      collection: collection.name,
      operation,
    });
  }

  return new Hono<Env>()
    .get('/', async (c) => {
      const rows = await repo(c).find(parseFindQuery(collection, c.req.query()));
      const readPolicy = collection.access?.read;
      // Policy filtert vor der Relation-Auflösung (kein Leak über `include`).
      const visible = readPolicy ? await filterByReadPolicy(c, rows, readPolicy) : rows;
      return c.json(await withIncludes(c, visible));
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
      const [resolved] = await withIncludes(c, [record]);
      return c.json(resolved);
    })
    .post('/', async (c) => {
      const parsed = schemas.insert.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const auth = await authorize(c, 'write');
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      // beforeChange läuft nach Validierung/Policy, aber vor der Persistenz und
      // darf `doc` verändern (z. B. Slug ableiten) oder mit 422 abbrechen.
      const doc = parsed.data as Record<string, unknown>;
      const blocked = await beforeChange(c, doc, 'create');
      if (blocked) return blocked;
      const record = await repo(c).create(doc);
      await afterChange(c, record, 'create');
      indexAfter(c, record);
      emitWrite(c, record, 'create');
      return c.json(record, 201);
    })
    .put('/:id', async (c) => {
      const parsed = schemas.update.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
      const existing = await repo(c).get(c.req.param('id'));
      if (!existing) return c.json({ error: 'not found' }, 404);
      const auth = await authorize(c, 'write', existing);
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      const doc = parsed.data as Record<string, unknown>;
      const blocked = await beforeChange(c, doc, 'update');
      if (blocked) return blocked;
      const record = await repo(c).update(c.req.param('id'), doc);
      if (!record) return c.json({ error: 'not found' }, 404);
      await afterChange(c, record, 'update');
      indexAfter(c, record);
      emitWrite(c, record, 'update');
      return c.json(record);
    })
    .delete('/:id', async (c) => {
      const id = c.req.param('id');
      const existing = await repo(c).get(id);
      if (!existing) return c.json({ error: 'not found' }, 404);
      const auth = await authorize(c, 'write', existing);
      if (!auth.allowed) return c.json({ error: 'forbidden', policy: auth.policy }, 403);
      const ok = await repo(c).remove(id);
      if (ok) {
        removeAfter(c, id);
        c.var.platform.events.emit('content.deleted', { collection: collection.name, id });
      }
      return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
    });
}

export function contentRoutes(collection: CollectionConfig, routeOpts: RouteOptions = {}) {
  const repo = (c: Context<Env>) => collectionRepository(c.var.platform.db, collection);
  const registry = routeOpts.registry;
  async function withIncludes(
    c: Context<Env>,
    rows: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const include = parseInclude(c.req.query('include'));
    if (!registry || include.length === 0) return rows;
    return resolveIncludes(c.var.platform.db, collection, rows, include, registry);
  }
  return new Hono<Env>()
    .get('/', async (c) => {
      const rows = await repo(c).find({
        ...parseFindQuery(collection, c.req.query()),
        publishedOnly: true,
      });
      return c.json(await withIncludes(c, rows));
    })
    .get('/:id', async (c) => {
      const record = await repo(c).get(c.req.param('id'), { publishedOnly: true });
      if (!record) return c.json({ error: 'not found' }, 404);
      const [resolved] = await withIncludes(c, [record]);
      return c.json(resolved);
    });
}
