import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { createFts5SearchAdapter, searchableFields } from './fts5.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true, searchable: true }),
    body: field.richText({ searchable: true }),
    status: field.enum(['draft', 'published']),
  },
});

describe('searchableFields', () => {
  it('returns only fields marked searchable', () => {
    expect(searchableFields(blog)).toEqual(['title', 'body']);
  });
});

describe('createFts5SearchAdapter', () => {
  let db: ReturnType<typeof drizzle>;
  let adapter: ReturnType<typeof createFts5SearchAdapter>;

  beforeEach(() => {
    db = drizzle(createClient({ url: ':memory:' }));
    adapter = createFts5SearchAdapter(db, { fieldsByCollection: { blog: ['title', 'body'] } });
  });

  it('indexes documents and returns hits ranked by relevance', async () => {
    await adapter.index('blog', 'p1', {
      title: 'Cloudflare workers are fast',
      body: 'edge runtime',
    });
    await adapter.index('blog', 'p2', {
      title: 'Astro and Hono',
      body: 'cloudflare worker bridge',
    });
    await adapter.index('blog', 'p3', { title: 'Static site', body: 'jekyll alternative' });

    const hits = await adapter.query('blog', 'cloudflare');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.map((h) => h.id)).toEqual(expect.arrayContaining(['p1', 'p2']));
    expect(hits.every((h) => typeof h.score === 'number')).toBe(true);
  });

  it('re-indexing the same id replaces the old content', async () => {
    await adapter.index('blog', 'p1', { title: 'alpha', body: '' });
    expect((await adapter.query('blog', 'alpha')).map((h) => h.id)).toContain('p1');

    await adapter.index('blog', 'p1', { title: 'beta', body: '' });
    expect(await adapter.query('blog', 'alpha')).toHaveLength(0);
    expect((await adapter.query('blog', 'beta')).map((h) => h.id)).toContain('p1');
  });

  it('remove drops a document from the index', async () => {
    await adapter.index('blog', 'p1', { title: 'remove me', body: '' });
    await adapter.remove('blog', 'p1');
    expect(await adapter.query('blog', 'remove')).toEqual([]);
  });

  it('returns [] for unknown collections (no searchable fields)', async () => {
    expect(await adapter.query('unknown', 'anything')).toEqual([]);
  });

  it('serializes non-string values so they are searchable', async () => {
    await adapter.index('blog', 'p1', {
      title: 'about',
      body: JSON.stringify({ text: 'serialized rich text' }),
    });
    expect((await adapter.query('blog', 'serialized')).map((h) => h.id)).toContain('p1');
  });
});
