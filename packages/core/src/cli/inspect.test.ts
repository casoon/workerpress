import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { migrationSnapshot } from '../db/migrate.js';
import { field } from '../fields/index.js';
import { inspect } from './inspect.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ unique: true, indexed: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    body: field.richText(),
  },
});

describe('inspect', () => {
  it('default target covers schema, routes and migration', () => {
    const out = inspect([blog]);
    expect(out).toContain('# Collection: blog');
    expect(out).toContain('## Table');
    expect(out).toContain('title text NOT NULL');
    expect(out).toContain('## Indexes');
    expect(out).toContain('UNIQUE blog_slug_idx');
    expect(out).toContain('## Zod schemas');
    expect(out).toContain('insert:');
    expect(out).toContain('## REST routes for blog');
    expect(out).toContain('POST   /api/internal/content/blog');
    expect(out).toContain('GET    /api/content/blog');
    expect(out).toContain('## Migration (initial)');
    expect(out).toContain('CREATE TABLE "blog"');
  });

  it('--routes filters to the routes section', () => {
    const out = inspect([blog], { target: 'routes' });
    expect(out).toContain('## REST routes for blog');
    expect(out).not.toContain('## Table');
    expect(out).not.toContain('## Migration');
  });

  it('--migrations against a current snapshot is a no-op', () => {
    const snapshot = migrationSnapshot([blog]);
    const out = inspect([blog], { target: 'migrations', previousSnapshot: snapshot });
    expect(out).toContain('## Migration (next vs snapshot)');
    expect(out).toContain('no changes');
  });

  it('filters by collection name', () => {
    const pages = defineCollection({ name: 'pages', fields: { title: field.text() } });
    const out = inspect([blog, pages], { collection: 'pages', target: 'routes' });
    expect(out).toContain('## REST routes for pages');
    expect(out).not.toContain('## REST routes for blog');
  });

  it('reports unknown collection', () => {
    expect(inspect([blog], { collection: 'nope' })).toContain('Unknown collection: nope');
  });
});
