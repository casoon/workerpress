import { describe, expect, it } from 'vitest';
import { createQueryClient, findToQuery } from './client.js';
import { defineCollection } from './collections/index.js';
import { field } from './fields/index.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    status: field.enum(['draft', 'published']),
    publishedAt: field.date(),
    author: field.relation({ to: 'users' }),
  },
});

describe('findToQuery', () => {
  it('serializes scalar where, operators, orderBy, include, pagination', () => {
    const qs = findToQuery({
      where: { status: 'published', views: { gt: 5 } },
      include: ['author'],
      orderBy: '-publishedAt',
      limit: 10,
      offset: 20,
    }).toString();
    expect(qs).toContain('where%5Bstatus%5D=published'); // where[status]=published
    expect(qs).toContain('where%5Bviews%5D%5Bgt%5D=5'); // where[views][gt]=5
    expect(qs).toContain('include=author');
    expect(qs).toContain('orderBy=-publishedAt');
    expect(qs).toContain('limit=10');
    expect(qs).toContain('offset=20');
  });
});

describe('createQueryClient', () => {
  it('builds a typed find that hits the content surface', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return new Response(JSON.stringify([{ id: '1', title: 'Hi' }]), {
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    const api = createQueryClient({ blog }, { baseUrl: 'https://cms.test', fetch: fakeFetch });
    const rows = await api.blog.find({
      where: { status: 'published' },
      include: ['author'],
      orderBy: '-publishedAt',
      limit: 10,
    });

    expect(rows[0]?.title).toBe('Hi');
    expect(calls[0]).toContain('https://cms.test/api/content/blog?');
    expect(calls[0]).toContain('where%5Bstatus%5D=published');
    expect(calls[0]).toContain('include=author');
  });

  it('targets the internal surface when requested', async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return new Response('[]', { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const api = createQueryClient({ blog }, { surface: 'internal', fetch: fakeFetch });
    await api.blog.find();
    expect(calls[0]).toBe('/api/internal/content/blog');
  });
});
