import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { generateMigration } from '../db/migrate.js';
import { collectionRepository } from '../db/repository.js';
import { field } from '../fields/index.js';
import type { AuthUser, Platform } from '../platform/index.js';
import { contentRoutes, internalRoutes } from './routes.js';

const articles = defineCollection({
  name: 'articles',
  fields: {
    title: field.text({ required: true, max: 100 }),
    slug: field.slug({ unique: true, indexed: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    views: field.number(),
    body: field.richText(),
  },
});

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  const { sql } = generateMigration([articles]);
  await client.executeMultiple(sql as string);
  return db;
}

describe('collectionRepository', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('creates and reads hybrid column/json values (db default applies)', async () => {
    const repo = collectionRepository(db, articles);
    const created = await repo.create({ title: 'A', slug: 'a', body: { text: 'hi' } });
    expect(created).toMatchObject({ title: 'A', slug: 'a', status: 'draft' });
    expect((created.body as { text: string }).text).toBe('hi');
    expect(await repo.get(created.id as string)).toMatchObject({ title: 'A', slug: 'a' });
  });

  it('paginates, filters and sorts', async () => {
    const repo = collectionRepository(db, articles);
    await repo.create({ title: 'B', slug: 'b', status: 'published' });
    await repo.create({ title: 'A', slug: 'a', status: 'published' });
    await repo.create({ title: 'C', slug: 'c', status: 'draft' });

    expect(await repo.list({ where: { status: 'published' } })).toHaveLength(2);
    expect((await repo.list({ orderBy: 'title', order: 'asc' })).map((r) => r.title)).toEqual([
      'A',
      'B',
      'C',
    ]);
    const page = await repo.list({ limit: 1, offset: 1, orderBy: 'title' });
    expect(page).toHaveLength(1);
    expect(page[0]?.title).toBe('B');
    expect(await repo.list({ publishedOnly: true })).toHaveLength(2);
  });

  it('updates and removes', async () => {
    const repo = collectionRepository(db, articles);
    const a = await repo.create({ title: 'X', slug: 'x' });
    const updated = await repo.update(a.id as string, { title: 'Y', body: { text: 'z' } });
    expect(updated?.title).toBe('Y');
    expect((updated?.body as { text: string }).text).toBe('z');
    expect(await repo.remove(a.id as string)).toBe(true);
    expect(await repo.get(a.id as string)).toBeNull();
  });
});

describe('content vs internal routes', () => {
  function app(db: ReturnType<typeof drizzle>) {
    const platform = { db } as unknown as Platform;
    return new Hono<{ Variables: { platform: Platform } }>()
      .use('*', async (c, next) => {
        c.set('platform', platform);
        await next();
      })
      .route('/api/internal/content/articles', internalRoutes(articles))
      .route('/api/content/articles', contentRoutes(articles));
  }

  async function post(a: ReturnType<typeof app>, body: unknown) {
    return a.request('/api/internal/content/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('internal CRUD works; content returns only published', async () => {
    const a = app(await setup());
    expect((await post(a, { title: 'Pub', slug: 'pub', status: 'published' })).status).toBe(201);
    await post(a, { title: 'Draft', slug: 'draft' });

    const internalList = (await (await a.request('/api/internal/content/articles')).json()) as [];
    expect(internalList).toHaveLength(2);

    const contentList = (await (await a.request('/api/content/articles')).json()) as Array<{
      status: string;
    }>;
    expect(contentList).toHaveLength(1);
    expect(contentList[0]?.status).toBe('published');
  });

  it('internal rejects invalid payloads', async () => {
    const a = app(await setup());
    expect((await post(a, { slug: 'no-title' })).status).toBe(400);
  });

  it('enforces collection access policies (write -> 403, read -> 404 on deny)', async () => {
    const { definePolicy } = await import('../policies/index.js');
    const onlyAdmins = definePolicy<unknown, { role?: string }>(
      'onlyAdmins',
      ({ user }) => user?.role === 'admin',
    );
    const gated = defineCollection({
      name: 'gated',
      fields: { title: field.text({ required: true }) },
      access: { read: onlyAdmins, write: onlyAdmins },
    });
    const db = await setup();
    await db.run(
      (await import('drizzle-orm'))
        .sql`CREATE TABLE "gated" ("id" text PRIMARY KEY NOT NULL, "title" text NOT NULL, "data" text NOT NULL DEFAULT '{}')`,
    );

    function build(user?: { role: string }) {
      const platform = { db } as unknown as Platform;
      return new Hono<{ Variables: { platform: Platform; user?: typeof user } }>()
        .use('*', async (c, next) => {
          c.set('platform', platform);
          if (user) c.set('user', user);
          await next();
        })
        .route('/g', internalRoutes(gated));
    }

    // anonymous: write -> 403 with policy name
    const anon = build();
    const forbidden = await anon.request('/g', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });
    expect(forbidden.status).toBe(403);
    expect(((await forbidden.json()) as { policy?: string }).policy).toBe('onlyAdmins');

    // admin: write -> 201, then read -> 200
    const admin = build({ role: 'admin' });
    const created = await admin.request('/g', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'X' }),
    });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { id: string }).id;
    expect((await admin.request(`/g/${id}`)).status).toBe(200);

    // anonymous reading existing record -> 404 (don't leak existence)
    expect((await anon.request(`/g/${id}`)).status).toBe(404);

    // anonymous: list -> empty (read policy filters server-side)
    const list = (await (await anon.request('/g')).json()) as unknown[];
    expect(list).toHaveLength(0);

    // admin: list -> sees the record
    const adminList = (await (await admin.request('/g')).json()) as unknown[];
    expect(adminList).toHaveLength(1);
  });
});

describe('lifecycle hooks (M2-2)', () => {
  async function setupWith(collection: ReturnType<typeof defineCollection>) {
    const client = createClient({ url: ':memory:' });
    const db = drizzle(client);
    const { sql } = generateMigration([collection]);
    await client.executeMultiple(sql as string);
    return db;
  }

  function appFor(
    db: ReturnType<typeof drizzle>,
    collection: ReturnType<typeof defineCollection>,
    user?: AuthUser,
  ) {
    const platform = { db } as unknown as Platform;
    return new Hono<{ Variables: { platform: Platform; user?: AuthUser } }>()
      .use('*', async (c, next) => {
        c.set('platform', platform);
        if (user) c.set('user', user);
        await next();
      })
      .route('/c', internalRoutes(collection));
  }

  function post(a: ReturnType<typeof appFor>, body: unknown) {
    return a.request('/c', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('runs beforeChange (priority-ordered, mutating doc) then afterChange on create', async () => {
    const order: string[] = [];
    const collection = defineCollection({
      name: 'hooked',
      fields: { title: field.text({ required: true }), slug: field.slug() },
      hooks: {
        beforeChange: [
          { handler: () => void order.push('before-late'), priority: 5 },
          {
            handler: ({ doc, collection: name, operation }) => {
              order.push(`before-early:${name}:${operation}`);
              if (!doc.slug && typeof doc.title === 'string') {
                doc.slug = doc.title.toLowerCase().replace(/\s+/g, '-');
              }
            },
            priority: -1,
          },
        ],
        afterChange: [({ doc }) => void order.push(`after:${doc.slug}`)],
      },
    });
    const a = appFor(await setupWith(collection), collection);
    const res = await post(a, { title: 'Hello World' });
    expect(res.status).toBe(201);
    const rec = (await res.json()) as { slug: string };
    expect(rec.slug).toBe('hello-world');
    expect(order).toEqual(['before-early:hooked:create', 'before-late', 'after:hello-world']);
  });

  it('returns 422 when a beforeChange hook throws', async () => {
    const collection = defineCollection({
      name: 'guarded',
      fields: { title: field.text({ required: true }) },
      hooks: {
        beforeChange: [
          () => {
            throw new Error('title is taken');
          },
        ],
      },
    });
    const a = appFor(await setupWith(collection), collection);
    const res = await post(a, { title: 'x' });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'title is taken' });
  });

  it('supports async hooks', async () => {
    let ran = false;
    const collection = defineCollection({
      name: 'asyncc',
      fields: { title: field.text({ required: true }) },
      hooks: {
        beforeChange: [
          async () => {
            await Promise.resolve();
            ran = true;
          },
        ],
      },
    });
    const a = appFor(await setupWith(collection), collection);
    expect((await post(a, { title: 'x' })).status).toBe(201);
    expect(ran).toBe(true);
  });
});
