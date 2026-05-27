/**
 * Platform-Contract — kein Domänen-Code greift direkt auf Bindings zu.
 * Pro Plattform implementiert (Cloudflare = D1/R2/KV/Queues; Bunny = libSQL/Storage/Fallback).
 * Siehe ../../PORTABILITY.md.
 */

export interface ObjectStorage {
  put(key: string, data: ReadableStream | ArrayBuffer | Blob): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;
}

export interface KeyValue {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { ttl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface SearchableDoc {
  [field: string]: string | number | boolean | null;
}

export interface SearchOpts {
  limit?: number;
  offset?: number;
}

export interface SearchHit {
  id: string;
  score: number;
}

export interface SearchAdapter {
  index(collection: string, id: string, doc: SearchableDoc): Promise<void>;
  remove(collection: string, id: string): Promise<void>;
  query(collection: string, q: string, opts?: SearchOpts): Promise<SearchHit[]>;
}

export interface EventBus {
  emit<E extends string>(event: E, payload: unknown): void;
}

/** Authentifizierter Nutzer — minimaler Kontrakt, der für Policies reicht. */
export interface AuthUser {
  id: string;
  email: string;
  groups?: string[];
}

/** Liefert den authentifizierten Nutzer für eine Anfrage (oder null). */
export interface AuthVerifier {
  verify(request: Request): Promise<AuthUser | null>;
}

/** Auth-Stub für Plattformen ohne eigene Auth-Integration (immer null). */
export const noopAuth: AuthVerifier = {
  async verify() {
    return null;
  },
};

/** Drizzle-Datenbank-Handle (libSQL: D1 ODER Bunny Database). */
// biome-ignore lint/suspicious/noExplicitAny: konkreter Drizzle-Typ wird beim Adapter gesetzt
export type DrizzleDatabase = any;

export interface Platform {
  db: DrizzleDatabase;
  storage: ObjectStorage;
  kv: KeyValue;
  defer(work: () => Promise<void>): void;
  search: SearchAdapter;
  events: EventBus;
  /** Resolves the authenticated user from an incoming Request (M1-7). */
  auth: AuthVerifier;
}
