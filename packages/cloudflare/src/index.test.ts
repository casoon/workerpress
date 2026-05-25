/// <reference types="@cloudflare/workers-types" />

import type { Platform } from '@workerpress/core';
import { describe, expect, it } from 'vitest';
import { type CloudflareBindings, createCloudflarePlatform } from './index.js';

function makeBindings(): { env: CloudflareBindings; kv: Map<string, string> } {
  const kv = new Map<string, string>();
  const env = {
    DB: {} as D1Database,
    MEDIA: {
      put: async () => ({}) as R2Object,
      get: async () => null,
      delete: async () => undefined,
    } as unknown as R2Bucket,
    CACHE: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => {
        kv.set(key, value);
      },
      delete: async (key: string) => {
        kv.delete(key);
      },
    } as unknown as KVNamespace,
  } satisfies CloudflareBindings;
  return { env, kv };
}

function makeCtx(): { ctx: ExecutionContext; waited: Promise<unknown>[] } {
  const waited: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => {
      waited.push(p);
    },
    passThroughOnException: () => undefined,
  } as unknown as ExecutionContext;
  return { ctx, waited };
}

describe('createCloudflarePlatform', () => {
  it('satisfies the Platform interface', () => {
    const { env } = makeBindings();
    const { ctx } = makeCtx();
    const platform: Platform = createCloudflarePlatform(env, ctx);

    expect(platform.db).toBeDefined();
    expect(typeof platform.storage.url).toBe('function');
    expect(typeof platform.kv.get).toBe('function');
    expect(typeof platform.defer).toBe('function');
    expect(platform.search).toBeDefined();
    expect(platform.events).toBeDefined();
  });

  it('round-trips values through the KV binding', async () => {
    const { env } = makeBindings();
    const { ctx } = makeCtx();
    const platform = createCloudflarePlatform(env, ctx);

    await platform.kv.put('k', 'v');
    expect(await platform.kv.get('k')).toBe('v');
    expect(await platform.kv.get('missing')).toBeNull();
  });

  it('forwards deferred work to executionCtx.waitUntil', () => {
    const { env } = makeBindings();
    const { ctx, waited } = makeCtx();
    const platform = createCloudflarePlatform(env, ctx);

    platform.defer(async () => undefined);
    expect(waited).toHaveLength(1);
  });

  it('builds storage URLs from the configured base', () => {
    const { env } = makeBindings();
    const { ctx } = makeCtx();
    const platform = createCloudflarePlatform(env, ctx, {
      mediaBaseUrl: 'https://cdn.example.com',
    });

    expect(platform.storage.url('a/b.png')).toBe('https://cdn.example.com/a/b.png');
  });
});
