import { describe, expect, it, vi } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import type { Platform } from '../platform/index.js';
import {
  readThroughContent,
  resolveRevalidateTargets,
  revalidateOnWrite,
  revalidatePaths,
  revalidateTag,
  siteCacheKey,
} from './revalidate.js';

/** Minimal-Platform mit In-Memory-KV und Spy-Cache. */
function fakePlatform() {
  const store = new Map<string, string>();
  const deletedUrls: string[] = [];
  const platform = {
    kv: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async put(key: string, value: string) {
        store.set(key, value);
      },
      async delete(key: string) {
        store.delete(key);
      },
    },
    cache: {
      async delete(url: string) {
        deletedUrls.push(url);
      },
    },
  } as unknown as Platform;
  return { platform, store, deletedUrls };
}

const blog = defineCollection({
  name: 'blog',
  fields: { title: field.text({ required: true }), slug: field.slug() },
  revalidate: ['/blog', ({ doc }) => `/blog/${doc.slug}`],
});

describe('siteCacheKey + resolveRevalidateTargets', () => {
  it('builds a site-aware key', () => {
    expect(siteCacheKey('a.example.com', '/blog')).toBe('a.example.com:/blog');
    expect(siteCacheKey(undefined, '/blog')).toBe('*:/blog');
  });

  it('resolves static and dynamic revalidate targets', () => {
    expect(resolveRevalidateTargets(blog, { slug: 'hello' })).toEqual(['/blog', '/blog/hello']);
  });
});

describe('revalidatePaths', () => {
  it('deletes the KV page key and the edge-cache URL per path', async () => {
    const { platform, store, deletedUrls } = fakePlatform();
    store.set('wp:page:a.example.com:/blog', 'cached');
    await revalidatePaths(platform, ['/blog'], {
      host: 'a.example.com',
      origin: 'https://a.example.com',
    });
    expect(store.has('wp:page:a.example.com:/blog')).toBe(false);
    expect(deletedUrls).toEqual(['https://a.example.com/blog']);
  });
});

describe('read-through content cache + tag invalidation', () => {
  it('caches on miss and serves on hit', async () => {
    const { platform } = fakePlatform();
    const load = vi.fn(async () => [{ id: '1' }]);
    const a = await readThroughContent(platform, { collection: 'blog', suffix: 'list' }, load);
    const b = await readThroughContent(platform, { collection: 'blog', suffix: 'list' }, load);
    expect(a).toEqual(b);
    expect(load).toHaveBeenCalledTimes(1); // second call is a cache hit
  });

  it('revalidateTag forces the next read to miss', async () => {
    const { platform } = fakePlatform();
    const load = vi.fn(async () => [{ id: '1' }]);
    await readThroughContent(platform, { collection: 'blog', suffix: 'list' }, load);
    await revalidateTag(platform, 'blog');
    await readThroughContent(platform, { collection: 'blog', suffix: 'list' }, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('is site-aware: different hosts do not collide', async () => {
    const { platform } = fakePlatform();
    const loadMain = vi.fn(async () => ['main']);
    const loadLanding = vi.fn(async () => ['landing']);
    const main = await readThroughContent(
      platform,
      { host: 'main.example.com', collection: 'blog', suffix: 'list' },
      loadMain,
    );
    const landing = await readThroughContent(
      platform,
      { host: 'landing.example.com', collection: 'blog', suffix: 'list' },
      loadLanding,
    );
    expect(main).toEqual(['main']);
    expect(landing).toEqual(['landing']);
  });
});

describe('revalidateOnWrite', () => {
  it('invalidates explicit paths and bumps the collection tag', async () => {
    const { platform, store, deletedUrls } = fakePlatform();
    await revalidateOnWrite(platform, blog, { slug: 'hello' }, { host: 'h', origin: 'https://h' });
    expect(deletedUrls).toEqual(['https://h/blog', 'https://h/blog/hello']);
    expect(store.get('wp:cv:h:blog')).toBe('1'); // tag version bumped
  });
});
