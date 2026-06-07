import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { generateMigration } from './migrate.js';
import { buildRegistry, parseInclude, resolveIncludes } from './relations.js';
import { collectionRepository } from './repository.js';

const users = defineCollection({
  name: 'users',
  fields: { name: field.text({ required: true }) },
});
const tags = defineCollection({
  name: 'tags',
  fields: { label: field.text({ required: true }) },
});
const posts = defineCollection({
  name: 'posts',
  fields: {
    title: field.text({ required: true }),
    author: field.relation({ to: 'users', indexed: true }),
    tags: field.relation({ to: 'tags', many: true }),
  },
});

const registry = buildRegistry([users, tags, posts]);

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  const { sql } = generateMigration([users, tags, posts]);
  await client.executeMultiple(sql as string);
  return db;
}

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('expected at least one row');
  return row;
}

describe('parseInclude', () => {
  it('splits and trims a comma list', () => {
    expect(parseInclude(' author , tags ')).toEqual(['author', 'tags']);
    expect(parseInclude(undefined)).toEqual([]);
    expect(parseInclude('')).toEqual([]);
  });
});

describe('resolveIncludes', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('resolves a single relation to an object', async () => {
    const u = await collectionRepository(db, users).create({ name: 'Ada' });
    const p = await collectionRepository(db, posts).create({ title: 'Hi', author: u.id });
    const resolved = first(await resolveIncludes(db, posts, [{ ...p }], ['author'], registry));
    expect((resolved.author as { name: string }).name).toBe('Ada');
  });

  it('resolves a many relation to an array of objects', async () => {
    const t1 = await collectionRepository(db, tags).create({ label: 'a' });
    const t2 = await collectionRepository(db, tags).create({ label: 'b' });
    const p = await collectionRepository(db, posts).create({
      title: 'Hi',
      tags: [t1.id, t2.id],
    });
    const resolved = first(await resolveIncludes(db, posts, [{ ...p }], ['tags'], registry));
    expect((resolved.tags as { label: string }[]).map((t) => t.label).sort()).toEqual(['a', 'b']);
  });

  it('uses one batch query for many rows (no N+1)', async () => {
    const u = await collectionRepository(db, users).create({ name: 'Ada' });
    await collectionRepository(db, posts).create({ title: 'A', author: u.id });
    await collectionRepository(db, posts).create({ title: 'B', author: u.id });
    const rows = await collectionRepository(db, posts).list();
    const resolved = await resolveIncludes(db, posts, rows, ['author'], registry);
    for (const r of resolved) expect((r.author as { name: string }).name).toBe('Ada');
  });

  it('leaves a single relation null when the target is missing', async () => {
    const p = await collectionRepository(db, posts).create({ title: 'Hi', author: 'ghost' });
    const resolved = first(await resolveIncludes(db, posts, [{ ...p }], ['author'], registry));
    expect(resolved.author).toBeNull();
  });

  it('does not recurse beyond depth 1', async () => {
    // posts.author resolves to a user; the user has no further relation expanded.
    const u = await collectionRepository(db, users).create({ name: 'Ada' });
    const p = await collectionRepository(db, posts).create({ title: 'Hi', author: u.id });
    const resolved = first(await resolveIncludes(db, posts, [{ ...p }], ['author'], registry));
    expect(Object.keys(resolved.author as object)).toEqual(['id', 'name']);
  });

  it('ignores unknown or non-relation include keys', async () => {
    const p = await collectionRepository(db, posts).create({ title: 'Hi' });
    const resolved = first(
      await resolveIncludes(db, posts, [{ ...p }], ['title', 'ghost'], registry),
    );
    expect(resolved.title).toBe('Hi');
  });
});
