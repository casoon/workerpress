import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { definePlugin } from '../plugins/index.js';
import { definePolicy } from '../policies/index.js';
import {
  collectionRoutes,
  describeCollectionsData,
  describeRoutesData,
  scaffoldCollection,
} from './describe.js';

const isPublished = definePolicy('isPublished', () => true);
const blog = defineCollection({
  name: 'blog',
  version: 2,
  fields: {
    title: field.text({ required: true }),
    body: field.richText({ searchable: true }),
  },
  access: { read: isPublished },
  hooks: { beforeChange: [() => {}] },
});

describe('collectionRoutes', () => {
  it('emits content + internal routes with auth + search', () => {
    const routes = collectionRoutes(blog, { history: true });
    const paths = routes.map((r) => `${r.method} ${r.path}`);
    expect(paths).toContain('GET /api/content/blog');
    expect(paths).toContain('POST /api/internal/content/blog');
    expect(paths).toContain('GET /api/internal/content/blog/search');
    expect(paths).toContain('GET /api/internal/content/blog/:id/versions');
    expect(routes.find((r) => r.method === 'GET' && r.path === '/api/content/blog')?.auth).toBe(
      'policy:isPublished',
    );
  });
});

describe('describeRoutesData', () => {
  it('includes system + token routes and plugin routes', () => {
    const plugin = definePlugin({ name: 'comments', version: '1', routes: (a) => a });
    const routes = describeRoutesData([blog], [plugin], { tokens: true });
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/api/health');
    expect(paths).toContain('/api/internal/tokens');
    expect(paths).toContain('/api/internal/plugins/comments/*');
  });
});

describe('describeCollectionsData', () => {
  it('reports version, field count, policies, hooks', () => {
    const [info] = describeCollectionsData([blog]);
    expect(info?.version).toBe(2);
    expect(info?.fields).toBe(2);
    expect(info?.policies.read).toBe('isPublished');
    expect(info?.policies.write).toBeNull();
    expect(info?.hooks.beforeChange).toBe(1);
    expect(info?.searchable).toEqual(['body']);
  });
});

describe('scaffoldCollection', () => {
  it('produces a valid defineCollection module', () => {
    const code = scaffoldCollection('products');
    expect(code).toContain("name: 'products'");
    expect(code).toContain('defineCollection');
    expect(code).toContain('@workerpress/core');
  });

  it('sanitizes the name', () => {
    expect(scaffoldCollection('weird-name!')).toContain("name: 'weirdname'");
  });
});
