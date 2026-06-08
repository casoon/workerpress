/**
 * Bunny-Adapter (M0-8, Spike) — implementiert den `Platform`-Contract für Bunny:
 * DB über Drizzle/libSQL (Bunny Database), Storage über die Bunny-Storage-HTTP-API
 * und einen KV-Fallback über eine libSQL-Tabelle (Bunny hat kein natives KV).
 * Ziel: zeigen, dass derselbe Domänen-Code (Repository, Routen) ohne Änderung
 * auch über Bunny trägt. Siehe PORTABILITY.md / docs/portability-bunny.md.
 */

import { createClient } from '@libsql/client';
import {
  type CachePurge,
  type EventBus,
  type KeyValue,
  noopAuth,
  type ObjectStorage,
  type Platform,
  type SearchAdapter,
} from '@workerpress/core';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';

export interface BunnyStorageOptions {
  /** Bunny Storage Zone (Storage-Zonenname). */
  zone: string;
  /** Storage-Zonen-Passwort (AccessKey). */
  accessKey: string;
  /** Öffentliche Pull-Zone-Basis-URL für Links. */
  baseUrl: string;
  /** Storage-Endpunkt (Region), Default Frankfurt. */
  endpoint?: string;
}

/** Bunny Storage über die HTTP-API (PUT/GET/DELETE auf storage.bunnycdn.com). */
export function bunnyStorage(
  opts: BunnyStorageOptions,
  fetchImpl: typeof fetch = fetch,
): ObjectStorage {
  const endpoint = (opts.endpoint ?? 'https://storage.bunnycdn.com').replace(/\/$/, '');
  const base = opts.baseUrl.replace(/\/$/, '');
  const urlFor = (key: string) => `${endpoint}/${opts.zone}/${key}`;
  return {
    async put(key, data) {
      const res = await fetchImpl(urlFor(key), {
        method: 'PUT',
        headers: { AccessKey: opts.accessKey },
        // `data` ist ReadableStream | ArrayBuffer | Blob — alle gültige fetch-Bodies.
        body: data as ArrayBuffer,
      });
      if (!res.ok) throw new Error(`Bunny storage put failed: ${res.status}`);
    },
    async get(key) {
      const res = await fetchImpl(urlFor(key), { headers: { AccessKey: opts.accessKey } });
      return res.ok ? res.body : null;
    },
    async delete(key) {
      await fetchImpl(urlFor(key), { method: 'DELETE', headers: { AccessKey: opts.accessKey } });
    },
    url(key) {
      return `${base}/${key}`;
    },
  };
}

const KV_TABLE = 'kv_store';

/** Stellt die KV-Fallback-Tabelle sicher (idempotent). */
export async function ensureKvTable(db: ReturnType<typeof drizzle>): Promise<void> {
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS ${sql.identifier(KV_TABLE)} ("key" text PRIMARY KEY NOT NULL, "value" text NOT NULL, "expires_at" integer)`,
  );
}

const nowSec = (): number => Math.floor(Date.now() / 1000);

/**
 * KV-Fallback über libSQL — Bunny bietet kein natives KV. Funktioniert, kostet
 * aber eine DB-Roundtrip-Latenz statt Edge-KV. TTL wird per `expires_at` + Lazy-
 * Expiry beim Lesen umgesetzt.
 */
export function libsqlKv(db: ReturnType<typeof drizzle>): KeyValue {
  return {
    async get(key) {
      const rows = (await db.all(
        sql`SELECT "value", "expires_at" FROM ${sql.identifier(KV_TABLE)} WHERE "key" = ${key} LIMIT 1`,
      )) as { value: string; expires_at: number | null }[];
      const row = rows[0];
      if (!row) return null;
      if (row.expires_at != null && row.expires_at <= nowSec()) {
        await db.run(sql`DELETE FROM ${sql.identifier(KV_TABLE)} WHERE "key" = ${key}`);
        return null;
      }
      return row.value;
    },
    async put(key, value, options) {
      const expiresAt = options?.ttl ? nowSec() + options.ttl : null;
      await db.run(
        sql`INSERT INTO ${sql.identifier(KV_TABLE)} ("key", "value", "expires_at") VALUES (${key}, ${value}, ${expiresAt}) ON CONFLICT("key") DO UPDATE SET "value" = excluded."value", "expires_at" = excluded."expires_at"`,
      );
    },
    async delete(key) {
      await db.run(sql`DELETE FROM ${sql.identifier(KV_TABLE)} WHERE "key" = ${key}`);
    },
  };
}

const noopSearch: SearchAdapter = {
  index: async () => undefined,
  remove: async () => undefined,
  query: async () => [],
};
const noopEvents: EventBus = { emit: () => undefined };
const noopCache: CachePurge = { delete: async () => undefined };

export interface BunnyPlatformOptions {
  /** libSQL-Connection-URL der Bunny Database (z. B. `libsql://…` oder `file:`/`:memory:`). */
  databaseUrl: string;
  authToken?: string;
  storage: BunnyStorageOptions;
  fetchImpl?: typeof fetch;
}

/**
 * Baut die Bunny-Platform. `defer` läuft ohne `waitUntil` (Bunny hat kein
 * äquivalentes Primitiv) als Fire-and-Forget — siehe Findings: hier klemmt es,
 * Hintergrundarbeit braucht eine echte Queue.
 */
export async function createBunnyPlatform(opts: BunnyPlatformOptions): Promise<Platform> {
  const client = createClient({ url: opts.databaseUrl, authToken: opts.authToken });
  const db = drizzle(client);
  await ensureKvTable(db);
  return {
    db,
    storage: bunnyStorage(opts.storage, opts.fetchImpl),
    kv: libsqlKv(db),
    defer(work) {
      // Kein waitUntil auf Bunny → Fire-and-Forget. Fehler werden geloggt.
      void work().catch((err) => console.error('[bunny] deferred work failed', err));
    },
    search: noopSearch,
    events: noopEvents,
    cache: noopCache,
    auth: noopAuth,
  };
}
