/**
 * Typsicherer Query-Client (M2-5) — `api.<collection>.find({ where, include,
 * orderBy, limit, offset })`. Schema-getrieben aus dem Field-System: `where` ist
 * je Feld auf erlaubte Operatoren typisiert, `orderBy` auf Feldnamen (mit `-`-
 * Präfix), `include` auf Relation-Felder. Serialisiert zu denselben Query-Params,
 * die der REST-Generator (M2-5) parst. Siehe ARCHITECTURE §9.
 */

import type { CollectionConfig } from './collections/index.js';
import type { Field, FieldType } from './fields/index.js';
import type { InferSelect } from './schema/types.js';

type Opt<F> = F extends Field<FieldType, infer O> ? O : never;

/** Erlaubte where-Operatoren je Field-Typ (deckt sich mit dem SQL-Builder). */
type WhereForField<F> =
  F extends Field<infer K, infer _O>
    ? K extends 'number'
      ?
          | number
          | { eq?: number; gt?: number; lt?: number; gte?: number; lte?: number; in?: number[] }
      : K extends 'date'
        ?
            | string
            | {
                eq?: string;
                gt?: string;
                lt?: string;
                gte?: string;
                lte?: string;
                between?: [string, string];
              }
        : K extends 'boolean'
          ? boolean | { eq?: boolean }
          : K extends 'enum'
            ? (Opt<F> extends { values: readonly (infer V)[] } ? V : string) extends infer E
              ? E | { eq?: E; in?: E[] }
              : never
            : string | { eq?: string; contains?: string; in?: string[] }
    : never;

/** Relation-Field-Keys einer Collection (für `include`). */
type RelationKeys<F> = {
  [K in keyof F]: F[K] extends Field<'relation', infer _O> ? K : never;
}[keyof F];

type OrderKey<F> = Extract<keyof F, string> | 'id';

/** Typsichere Argumente für `find` — schema-getrieben aus den Fields. */
export type FindArgs<C> =
  C extends CollectionConfig<infer F>
    ? {
        where?: { [K in keyof F]?: WhereForField<F[K]> };
        include?: Extract<RelationKeys<F>, string>[];
        orderBy?: OrderKey<F> | `-${OrderKey<F>}`;
        limit?: number;
        offset?: number;
      }
    : never;

/** Serialisiert `FindArgs` zu Query-Parametern (Gegenstück zu `parseFindQuery`). */
export function findToQuery(args: {
  where?: Record<string, unknown>;
  include?: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (args.limit !== undefined) params.set('limit', String(args.limit));
  if (args.offset !== undefined) params.set('offset', String(args.offset));
  if (args.orderBy) params.set('orderBy', args.orderBy);
  if (args.include?.length) params.set('include', args.include.join(','));
  for (const [field, value] of Object.entries(args.where ?? {})) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        params.set(`where[${field}][${op}]`, Array.isArray(v) ? v.join(',') : String(v));
      }
    } else {
      params.set(`where[${field}]`, String(value));
    }
  }
  return params;
}

export interface QueryClientOptions {
  /** Basis-URL, z. B. `''` (same-origin) oder `https://cms.example.com`. */
  baseUrl?: string;
  /** Oberfläche: `content` (read-only, published) oder `internal` (Vollzugriff). */
  surface?: 'content' | 'internal';
  /** Eigene fetch-Implementierung (Tests / Worker-zu-Worker). */
  fetch?: typeof fetch;
  /** Zusätzliche Header (z. B. API-Token, M2-7). */
  headers?: Record<string, string>;
}

/** Ein Collection-Client: aktuell `find`. */
export interface CollectionClient<C> {
  find(args?: FindArgs<C>): Promise<InferSelect<C>[]>;
}

/**
 * Baut einen typsicheren Client über eine Collection-Map. `api.blog.find(...)`
 * ist je Collection getypt; intern wird `GET /api/<surface>/content/<name>?…`
 * aufgerufen. Relationen werden serverseitig aufgelöst, wenn `include` gesetzt ist.
 */
export function createQueryClient<M extends Record<string, CollectionConfig>>(
  collections: M,
  options: QueryClientOptions = {},
): { [K in keyof M]: CollectionClient<M[K]> } {
  const base = options.baseUrl ?? '';
  const surface = options.surface ?? 'content';
  const doFetch = options.fetch ?? fetch;
  const prefix = surface === 'internal' ? '/api/internal/content' : '/api/content';

  const client = {} as { [K in keyof M]: CollectionClient<M[K]> };
  for (const [name, def] of Object.entries(collections) as [keyof M, CollectionConfig][]) {
    const collectionName = def.name;
    client[name] = {
      async find(args = {} as FindArgs<M[typeof name]>) {
        const qs = findToQuery(args as Parameters<typeof findToQuery>[0]).toString();
        const url = `${base}${prefix}/${collectionName}${qs ? `?${qs}` : ''}`;
        const res = await doFetch(url, { headers: options.headers });
        if (!res.ok) throw new Error(`find ${collectionName} failed: ${res.status}`);
        return (await res.json()) as InferSelect<M[typeof name]>[];
      },
    };
  }
  return client;
}
