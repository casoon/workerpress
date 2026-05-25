import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { type DerivedColumn, deriveTable } from './table.js';

function col(table: ReturnType<typeof deriveTable>, name: string): DerivedColumn | undefined {
  return table.columns.find((c) => c.name === name);
}

describe('deriveTable', () => {
  it('always emits an id primary key and a json data column', () => {
    const table = deriveTable(defineCollection({ name: 'empty', fields: {} }));
    expect(col(table, 'id')).toEqual({ name: 'id', type: 'text', notNull: true, primaryKey: true });
    expect(col(table, 'data')).toEqual({
      name: 'data',
      type: 'text',
      notNull: true,
      default: '{}',
    });
    expect(table.jsonColumn).toBe('data');
  });

  it('maps scalar field types to columns with nullability', () => {
    const table = deriveTable(
      defineCollection({
        name: 'things',
        fields: {
          title: field.text({ required: true }),
          count: field.number(),
          active: field.boolean(),
          when: field.date(),
          email: field.email(),
        },
      }),
    );
    expect(col(table, 'title')).toMatchObject({ type: 'text', notNull: true });
    expect(col(table, 'count')).toMatchObject({ type: 'real', notNull: false });
    expect(col(table, 'active')).toMatchObject({ type: 'integer' });
    expect(col(table, 'when')).toMatchObject({ type: 'integer' });
    expect(col(table, 'email')).toMatchObject({ type: 'text' });
  });

  it('captures defaults (enum literal, date now)', () => {
    const table = deriveTable(
      defineCollection({
        name: 'posts',
        fields: {
          status: field.enum(['draft', 'published'], { default: 'draft' }),
          created: field.date({ default: 'now' }),
        },
      }),
    );
    expect(col(table, 'status')?.default).toBe('draft');
    expect(col(table, 'created')?.default).toEqual({ now: true });
  });

  it('stores flexible field types in data, not as columns', () => {
    const table = deriveTable(
      defineCollection({
        name: 'docs',
        fields: {
          body: field.richText(),
          meta: field.json(),
          cover: field.media(),
        },
      }),
    );
    expect(col(table, 'body')).toBeUndefined();
    expect(col(table, 'meta')).toBeUndefined();
    expect(col(table, 'cover')).toBeUndefined();
    // only id + data
    expect(table.columns.map((c) => c.name)).toEqual(['id', 'data']);
  });

  it('single relation is a column, many relation goes to data', () => {
    const table = deriveTable(
      defineCollection({
        name: 'rel',
        fields: {
          author: field.relation({ to: 'users' }),
          tags: field.relation({ to: 'tags', many: true }),
        },
      }),
    );
    expect(col(table, 'author')).toMatchObject({ type: 'text' });
    expect(col(table, 'tags')).toBeUndefined();
  });

  it('indexed/unique scalar fields get an index on their column', () => {
    const table = deriveTable(
      defineCollection({
        name: 'pages',
        fields: {
          slug: field.slug({ unique: true, indexed: true }),
          status: field.enum(['a', 'b'], { indexed: true }),
        },
      }),
    );
    expect(table.indexes).toContainEqual({
      name: 'pages_slug_idx',
      columns: ['slug'],
      unique: true,
    });
    expect(table.indexes).toContainEqual({
      name: 'pages_status_idx',
      columns: ['status'],
      unique: false,
    });
  });

  it('indexed flexible field becomes a generated column plus index', () => {
    const table = deriveTable(
      defineCollection({
        name: 'rel',
        fields: {
          tags: field.relation({ to: 'tags', many: true, indexed: true }),
        },
      }),
    );
    expect(col(table, 'tags')).toMatchObject({ generatedFrom: '$.tags', notNull: false });
    expect(table.indexes).toContainEqual({
      name: 'rel_tags_idx',
      columns: ['tags'],
      unique: false,
    });
  });
});
