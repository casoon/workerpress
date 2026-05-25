import { describe, expectTypeOf, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import type { InferInsert, InferSelect } from './types.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug(),
    status: field.enum(['draft', 'published'], { required: true, default: 'draft' }),
    views: field.number(),
    tags: field.relation({ to: 'tags', many: true }),
    author: field.relation({ to: 'users' }),
    body: field.richText(),
  },
});

type Blog = InferSelect<typeof blog>;
type NewBlog = InferInsert<typeof blog>;

describe('InferSelect', () => {
  it('adds id and maps field value types', () => {
    expectTypeOf<Blog['id']>().toEqualTypeOf<string>();
    expectTypeOf<Blog['title']>().toEqualTypeOf<string>();
    expectTypeOf<Blog['status']>().toEqualTypeOf<'draft' | 'published'>();
    expectTypeOf<Blog['author']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Blog['tags']>().toEqualTypeOf<string[] | undefined>();
    expectTypeOf<Blog['views']>().toEqualTypeOf<number | undefined>();
  });
});

describe('InferInsert', () => {
  it('requires required-without-default fields; defaulted ones are optional', () => {
    expectTypeOf<NewBlog['title']>().toEqualTypeOf<string>();
    // status is required but has a default -> optional on insert
    expectTypeOf<NewBlog['status']>().toEqualTypeOf<'draft' | 'published' | undefined>();
    expectTypeOf<NewBlog['views']>().toEqualTypeOf<number | undefined>();
  });

  it('rejects missing required fields', () => {
    const ok: NewBlog = { title: 'Hello' };
    expectTypeOf(ok).toMatchTypeOf<{ title: string }>();
    // @ts-expect-error title is required
    const bad: NewBlog = {};
    void bad;
  });
});
