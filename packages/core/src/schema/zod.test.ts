import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { collectionSchemas } from './zod.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true, max: 5 }),
    slug: field.slug({ unique: true }),
    status: field.enum(['draft', 'published'], { default: 'draft' }),
    email: field.email(),
    homepage: field.url(),
    views: field.number(),
    published: field.boolean(),
    publishedAt: field.date(),
    author: field.relation({ to: 'users' }),
    tags: field.relation({ to: 'tags', many: true }),
  },
});

const { insert, update, select } = collectionSchemas(blog);

describe('insert schema', () => {
  it('requires required fields without a default', () => {
    expect(insert.safeParse({}).success).toBe(false); // title missing
    expect(insert.safeParse({ title: 'Hi' }).success).toBe(true); // status has default -> optional
  });

  it('enforces text max length', () => {
    expect(insert.safeParse({ title: 'toolong' }).success).toBe(false);
  });

  it('validates enum values', () => {
    expect(insert.safeParse({ title: 'Hi', status: 'nope' }).success).toBe(false);
    expect(insert.safeParse({ title: 'Hi', status: 'published' }).success).toBe(true);
  });

  it('validates email and url formats', () => {
    expect(insert.safeParse({ title: 'Hi', email: 'no' }).success).toBe(false);
    expect(insert.safeParse({ title: 'Hi', email: 'a@b.de' }).success).toBe(true);
    expect(insert.safeParse({ title: 'Hi', homepage: 'not-a-url' }).success).toBe(false);
  });

  it('validates number, boolean, date and relations', () => {
    expect(insert.safeParse({ title: 'Hi', views: 'x' }).success).toBe(false);
    expect(insert.safeParse({ title: 'Hi', views: 3, published: true }).success).toBe(true);
    expect(insert.safeParse({ title: 'Hi', publishedAt: '2024-01-01' }).success).toBe(true);
    expect(insert.safeParse({ title: 'Hi', author: 'u1', tags: ['t1', 't2'] }).success).toBe(true);
    expect(insert.safeParse({ title: 'Hi', tags: 'not-an-array' }).success).toBe(false);
  });
});

describe('update schema', () => {
  it('is fully partial but still type-checked', () => {
    expect(update.safeParse({}).success).toBe(true);
    expect(update.safeParse({ status: 'draft' }).success).toBe(true);
    expect(update.safeParse({ status: 'bad' }).success).toBe(false);
  });
});

describe('select schema', () => {
  it('requires id and parses a stored record', () => {
    expect(select.safeParse({ id: 'b1', title: 'Hi', slug: 'hi' }).success).toBe(true);
    expect(select.safeParse({ title: 'Hi' }).success).toBe(false); // id missing
  });
});
