import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { generateMigration } from './migrate.js';
import { parseFindQuery } from './query.js';
import { collectionRepository } from './repository.js';

const articles = defineCollection({
  name: 'articles',
  fields: {
    title: field.text({ required: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    views: field.number(),
    publishedAt: field.date({ indexed: true }),
    summary: field.text(),
  },
});

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  const { sql } = generateMigration([articles]);
  await client.executeMultiple(sql as string);
  const repo = collectionRepository(db, articles);
  await repo.create({
    title: 'Alpha',
    status: 'published',
    views: 10,
    publishedAt: new Date('2026-01-01'),
  });
  await repo.create({
    title: 'Beta',
    status: 'published',
    views: 50,
    publishedAt: new Date('2026-03-01'),
  });
  await repo.create({
    title: 'Gamma draft',
    status: 'draft',
    views: 5,
    publishedAt: new Date('2026-02-01'),
  });
  return repo;
}

describe('repository.find — where operators', () => {
  let repo: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    repo = await setup();
  });

  it('eq on enum (column)', async () => {
    const rows = await repo.find({ where: { status: { eq: 'published' } } });
    expect(rows).toHaveLength(2);
  });

  it('eq via scalar shorthand', async () => {
    const rows = await repo.find({ where: { status: 'draft' } });
    expect(rows).toHaveLength(1);
  });

  it('contains on text (json field)', async () => {
    const rows = await repo.find({ where: { title: { contains: 'draft' } } });
    expect(rows.map((r) => r.title)).toEqual(['Gamma draft']);
  });

  it('gt/lt on number', async () => {
    expect(await repo.find({ where: { views: { gt: 9 } } })).toHaveLength(2);
    expect(await repo.find({ where: { views: { lt: 9 } } })).toHaveLength(1);
  });

  it('in on enum', async () => {
    const rows = await repo.find({ where: { status: { in: ['draft'] } } });
    expect(rows).toHaveLength(1);
  });

  it('between on date', async () => {
    const rows = await repo.find({
      where: { publishedAt: { between: ['2026-01-15', '2026-02-15'] } },
    });
    expect(rows.map((r) => r.title)).toEqual(['Gamma draft']);
  });

  it('orderBy with - prefix sorts descending', async () => {
    const rows = await repo.find({ orderBy: '-views' });
    expect(rows.map((r) => r.views)).toEqual([50, 10, 5]);
  });

  it('combines where + orderBy + limit', async () => {
    const rows = await repo.find({
      where: { status: 'published' },
      orderBy: '-views',
      limit: 1,
    });
    expect(rows.map((r) => r.title)).toEqual(['Beta']);
  });

  it('ignores unknown fields and disallowed operators', async () => {
    const rows = await repo.find({ where: { ghost: 'x', status: { contains: 'pub' } } });
    // ghost ignored; contains is not allowed on enum -> no condition -> all rows
    expect(rows).toHaveLength(3);
  });
});

describe('parseFindQuery — REST mapping', () => {
  it('maps where[field], operators, orderBy, include, limit', () => {
    const opts = parseFindQuery(articles, {
      'where[status]': 'published',
      'where[views][gt]': '9',
      'where[publishedAt][between]': '2026-01-01,2026-02-01',
      orderBy: '-publishedAt',
      include: 'author,tags',
      limit: '10',
    });
    expect(opts.where?.status).toEqual({ eq: 'published' });
    expect(opts.where?.views).toEqual({ gt: '9' });
    expect(opts.where?.publishedAt).toEqual({ between: ['2026-01-01', '2026-02-01'] });
    expect(opts.orderBy).toBe('-publishedAt');
    expect(opts.include).toEqual(['author', 'tags']);
    expect(opts.limit).toBe(10);
  });

  it('supports flat field=value shorthand (back-compat)', () => {
    const opts = parseFindQuery(articles, { status: 'draft' });
    expect(opts.where?.status).toEqual({ eq: 'draft' });
  });
});
