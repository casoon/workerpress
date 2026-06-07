import { createClient } from '@libsql/client';
import {
  collectionRepository,
  defineCollection,
  field,
  generateMigration,
} from '@workerpress/core';
import { drizzle } from 'drizzle-orm/libsql';
import { describe, expect, it, vi } from 'vitest';
import { bunnyStorage, createBunnyPlatform, ensureKvTable, libsqlKv } from './index.js';

const blog = defineCollection({
  name: 'blog',
  fields: {
    title: field.text({ required: true }),
    slug: field.slug({ unique: true, indexed: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
  },
});

/** Bunny Database = libSQL. Migrationen + CRUD identisch zum D1-Pfad. */
function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  return { client, db };
}

describe('Bunny DB path (libSQL) — same domain code as D1', () => {
  it('runs migrations and full CRUD via collectionRepository', async () => {
    const { client, db } = setup();
    await client.executeMultiple(generateMigration([blog]).sql as string);

    const repo = collectionRepository(db, blog);
    const created = await repo.create({ title: 'Hallo', slug: 'hallo', status: 'published' });
    expect(created).toMatchObject({ title: 'Hallo', slug: 'hallo' });

    const got = await repo.get(created.id as string);
    expect(got?.title).toBe('Hallo');

    const updated = await repo.update(created.id as string, { title: 'Hallo Welt' });
    expect(updated?.title).toBe('Hallo Welt');

    expect(await repo.list({ publishedOnly: true })).toHaveLength(1);
    expect(await repo.remove(created.id as string)).toBe(true);
    expect(await repo.get(created.id as string)).toBeNull();
  });
});

describe('Bunny KV fallback (libSQL table)', () => {
  it('get/put/delete with TTL expiry', async () => {
    const { db } = setup();
    await ensureKvTable(db);
    const kv = libsqlKv(db);

    expect(await kv.get('missing')).toBeNull();
    await kv.put('a', 'one');
    expect(await kv.get('a')).toBe('one');
    await kv.put('a', 'two'); // upsert
    expect(await kv.get('a')).toBe('two');
    await kv.delete('a');
    expect(await kv.get('a')).toBeNull();

    // expired entry is lazily evicted
    await kv.put('exp', 'x', { ttl: -1 });
    expect(await kv.get('exp')).toBeNull();
  });

  it('measures rough fallback latency (informational)', async () => {
    const { db } = setup();
    await ensureKvTable(db);
    const kv = libsqlKv(db);
    const N = 50;
    const start = performance.now();
    for (let i = 0; i < N; i++) {
      await kv.put(`k${i}`, `v${i}`);
      await kv.get(`k${i}`);
    }
    const perOp = (performance.now() - start) / (N * 2);
    // In-Memory-libSQL ist sub-ms; gegen Bunny Database kommt Netzlatenz dazu.
    console.log(`[bunny] KV-Fallback ~${perOp.toFixed(3)} ms/op (in-memory libSQL)`);
    expect(perOp).toBeGreaterThanOrEqual(0);
  });
});

describe('Bunny Storage (HTTP API)', () => {
  it('puts/gets/deletes with the AccessKey header and builds public URLs', async () => {
    const calls: { url: string; method: string; key?: string }[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        method: init?.method ?? 'GET',
        key: (init?.headers as Record<string, string>)?.AccessKey,
      });
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    const storage = bunnyStorage(
      { zone: 'myzone', accessKey: 'secret', baseUrl: 'https://cdn.example.com' },
      fakeFetch,
    );
    await storage.put('img/a.png', new Uint8Array([1]).buffer);
    await storage.delete('img/a.png');
    expect(storage.url('img/a.png')).toBe('https://cdn.example.com/img/a.png');
    expect(calls[0]).toMatchObject({
      url: 'https://storage.bunnycdn.com/myzone/img/a.png',
      method: 'PUT',
      key: 'secret',
    });
    expect(calls[1]?.method).toBe('DELETE');
  });
});

describe('createBunnyPlatform — Platform contract', () => {
  it('exposes db/kv/storage/defer and runs deferred work', async () => {
    const platform = await createBunnyPlatform({
      databaseUrl: ':memory:',
      storage: { zone: 'z', accessKey: 'k', baseUrl: 'https://cdn' },
      fetchImpl: (async () => new Response('')) as unknown as typeof fetch,
    });
    expect(platform.db).toBeDefined();
    expect(platform.storage.url('x')).toBe('https://cdn/x');

    // KV-Fallback ist über dieselbe DB sofort nutzbar.
    await platform.kv.put('hello', 'world');
    expect(await platform.kv.get('hello')).toBe('world');

    // defer ist Fire-and-Forget (kein waitUntil) — läuft, blockt aber nicht.
    const ran = vi.fn();
    platform.defer(async () => {
      ran();
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toHaveBeenCalled();
  });
});
