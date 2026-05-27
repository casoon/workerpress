/// <reference types="@cloudflare/workers-types" />

import {
  createFts5SearchAdapter,
  type EventBus,
  type KeyValue,
  type ObjectStorage,
  type Platform,
  type SearchAdapter,
} from '@workerpress/core';
import { drizzle } from 'drizzle-orm/d1';

export interface CloudflareBindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  CACHE: KVNamespace;
}

export interface CloudflarePlatformOptions {
  /** Öffentliche Basis-URL für Objektspeicher-Links (R2). */
  mediaBaseUrl?: string;
  /** searchable Field-Keys pro Collection. Gesetzt -> FTS5-Adapter (M1-14). */
  searchableFieldsByCollection?: Record<string, string[]>;
}

function r2Storage(bucket: R2Bucket, baseUrl: string): ObjectStorage {
  const base = baseUrl.replace(/\/$/, '');
  return {
    async put(key, data) {
      await bucket.put(key, data);
    },
    async get(key) {
      const object = await bucket.get(key);
      return object?.body ?? null;
    },
    async delete(key) {
      await bucket.delete(key);
    },
    url(key) {
      return `${base}/${key}`;
    },
  };
}

function kvStore(namespace: KVNamespace): KeyValue {
  return {
    get(key) {
      return namespace.get(key);
    },
    async put(key, value, opts) {
      await namespace.put(key, value, opts?.ttl ? { expirationTtl: opts.ttl } : undefined);
    },
    async delete(key) {
      await namespace.delete(key);
    },
  };
}

/** Such- und Event-Schicht: in M0 No-op hinter dem Interface (FTS5/Events folgen in M1/M2). */
const noopSearch: SearchAdapter = {
  index: async () => undefined,
  remove: async () => undefined,
  query: async () => [],
};

const noopEvents: EventBus = {
  emit: () => undefined,
};

/**
 * Baut die Cloudflare-Platform aus `env` (Bindings) und `executionCtx`.
 * Einzige Stelle, an der Cloudflare-Idiome (D1/R2/KV/waitUntil) berührt werden.
 */
export function createCloudflarePlatform(
  env: CloudflareBindings,
  executionCtx: ExecutionContext,
  options: CloudflarePlatformOptions = {},
): Platform {
  const db = drizzle(env.DB);
  const fields = options.searchableFieldsByCollection ?? {};
  const search =
    Object.keys(fields).length > 0
      ? createFts5SearchAdapter(db, { fieldsByCollection: fields })
      : noopSearch;
  return {
    db,
    storage: r2Storage(env.MEDIA, options.mediaBaseUrl ?? '/media'),
    kv: kvStore(env.CACHE),
    defer(work) {
      executionCtx.waitUntil(work());
    },
    search,
    events: noopEvents,
  };
}
