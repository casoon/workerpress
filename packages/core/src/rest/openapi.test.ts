import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { openApiDocument } from './openapi.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ unique: true, indexed: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    publishedAt: field.date(),
    body: field.richText(),
  },
});

const doc = openApiDocument([blog], { title: 'Test API', version: '1.2.3' });

describe('openApiDocument', () => {
  it('is an OpenAPI 3.1 document with info', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'Test API', version: '1.2.3' });
  });

  it('describes content and internal endpoints', () => {
    const paths = doc.paths as Record<string, Record<string, unknown>>;
    expect(paths['/api/content/blog']?.get).toBeDefined();
    expect(paths['/api/content/blog/{id}']?.get).toBeDefined();
    expect(paths['/api/internal/content/blog']?.get).toBeDefined();
    expect(paths['/api/internal/content/blog']?.post).toBeDefined();
    expect(paths['/api/internal/content/blog/{id}']?.put).toBeDefined();
    expect(paths['/api/internal/content/blog/{id}']?.delete).toBeDefined();
  });

  it('registers insert/update/select schemas', () => {
    const schemas = (doc.components as { schemas: Record<string, unknown> }).schemas;
    expect(schemas.Blog).toBeDefined();
    expect(schemas.BlogInsert).toBeDefined();
    expect(schemas.BlogUpdate).toBeDefined();
  });

  it('describes pagination, sort and filter query params on the list', () => {
    const paths = doc.paths as Record<string, { get: { parameters: Array<{ name: string }> } }>;
    const names = paths['/api/internal/content/blog']?.get.parameters.map((p) => p.name) ?? [];
    expect(names).toEqual(
      expect.arrayContaining(['limit', 'offset', 'orderBy', 'order', 'status']),
    );
  });

  it('references the insert schema in the POST body', () => {
    const paths = doc.paths as Record<
      string,
      { post?: { requestBody: { content: { 'application/json': { schema: { $ref: string } } } } } }
    >;
    const ref =
      paths['/api/internal/content/blog']?.post?.requestBody.content['application/json'].schema
        .$ref;
    expect(ref).toBe('#/components/schemas/BlogInsert');
  });
});
