import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import { type CollectionConfig, defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { generateMigration, migrationSnapshot, tableToSql } from './migrate.js';
import { deriveTable } from './table.js';

const pages = defineCollection({
  name: 'pages',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ unique: true, indexed: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    body: field.richText(),
  },
});

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ unique: true, indexed: true }),
    author: field.relation({ to: 'users' }),
    tags: field.relation({ to: 'tags', many: true, indexed: true }),
    publishedAt: field.date(),
  },
});

describe('tableToSql', () => {
  it('emits columns, defaults and a unique index', () => {
    const { createTable, createIndexes } = tableToSql(deriveTable(pages));
    expect(createTable).toContain('"id" text PRIMARY KEY NOT NULL');
    expect(createTable).toContain('"title" text NOT NULL');
    expect(createTable).toContain(`"status" text DEFAULT 'draft'`);
    expect(createTable).toContain(`"data" text NOT NULL DEFAULT '{}'`);
    expect(createIndexes).toContain('CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" ("slug");');
  });

  it('emits a generated column for an indexed JSON field', () => {
    const { createTable, createIndexes } = tableToSql(deriveTable(blog));
    expect(createTable).toContain(
      `"tags" text GENERATED ALWAYS AS (json_extract("data", '$.tags')) VIRTUAL`,
    );
    expect(createIndexes).toContain('CREATE INDEX "blog_tags_idx" ON "blog" ("tags");');
  });
});

describe('generateMigration', () => {
  it('produces SQL that applies to SQLite and accepts rows', async () => {
    const { sql } = generateMigration([pages, blog]);
    expect(sql).toBeTruthy();

    const client = createClient({ url: ':memory:' });
    await client.executeMultiple(sql as string);

    await client.execute({
      sql: `INSERT INTO "pages" ("id", "title", "slug", "data") VALUES (?, ?, ?, ?)`,
      args: ['p1', 'Hello', 'hello', '{"body":"x"}'],
    });
    const rows = await client.execute('SELECT id, title, status FROM "pages"');
    expect(rows.rows[0]).toMatchObject({ id: 'p1', title: 'Hello', status: 'draft' });

    // unique index enforced
    await expect(
      client.execute({
        sql: `INSERT INTO "pages" ("id", "title", "slug", "data") VALUES (?, ?, ?, ?)`,
        args: ['p2', 'Dup', 'hello', '{}'],
      }),
    ).rejects.toThrow();
  });

  it('is a no-op when the snapshot is unchanged', () => {
    const collections: CollectionConfig[] = [pages, blog];
    const first = generateMigration(collections);
    const again = generateMigration(collections, first.snapshot);
    expect(again.sql).toBeNull();
  });

  it('regenerates when a collection changes', () => {
    const snapshot = migrationSnapshot([pages]);
    const changed = defineCollection({
      name: 'pages',
      fields: { ...pages.fields, summary: field.text() },
    });
    expect(generateMigration([changed], snapshot).sql).toBeTruthy();
  });
});
