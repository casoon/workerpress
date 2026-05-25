import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { generateMigration } from '../db/migrate.js';
import { collectionRepository } from '../db/repository.js';
import { field } from '../fields/index.js';
import type { Platform } from '../platform/index.js';
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
});
