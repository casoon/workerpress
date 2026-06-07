/**
 * Query-Layer (M2-5) — `find({ where, include, orderBy, limit, offset })`.
 * Eine Abfrage, schema-getrieben aus dem Field-System: dieselbe Beschreibung
 * speist REST, RPC und OpenAPI. SQL wird ausschließlich parametrisiert gebaut
 * (Drizzle `sql``), kein String-Bau → injection-sicher. Siehe ARCHITECTURE §9.
 */

import { type SQL, sql } from 'drizzle-orm';
import type { CollectionConfig } from '../collections/index.js';
import type { Field } from '../fields/index.js';

/** Vergleichs-Operatoren. Welche je Feld erlaubt sind, hängt vom Field-Typ ab. */
export interface WhereOperators {
  eq?: string | number | boolean;
  contains?: string;
  in?: (string | number)[];
  gt?: string | number;
  lt?: string | number;
  gte?: string | number;
  lte?: string | number;
  between?: [string | number, string | number];
}

export type WhereValue = string | number | boolean | WhereOperators;
export type FindWhere = Record<string, WhereValue>;

export interface FindOptions {
  where?: FindWhere;
  include?: string[];
  /** Feldname, optional mit `-`-Präfix für absteigend (`-publishedAt`). */
  orderBy?: string;
  limit?: number;
  offset?: number;
  publishedOnly?: boolean;
}

/** Erlaubte Operatoren je Field-Typ (Rest wird ignoriert → kein Leak/Fehler). */
const OPERATORS_BY_KIND: Record<string, (keyof WhereOperators)[]> = {
  text: ['eq', 'contains', 'in'],
  slug: ['eq', 'contains', 'in'],
  markdown: ['eq', 'contains', 'in'],
  richText: ['contains'],
  email: ['eq', 'contains', 'in'],
  url: ['eq', 'contains', 'in'],
  enum: ['eq', 'in'],
  number: ['eq', 'gt', 'lt', 'gte', 'lte', 'in'],
  date: ['eq', 'gt', 'lt', 'gte', 'lte', 'between'],
  boolean: ['eq'],
  relation: ['eq', 'in'],
};

function isColumn(field: Field, columns: Set<string>, key: string): boolean {
  return columns.has(key);
}

/** Spalten-Referenz: echte Spalte direkt, JSON-Feld via json_extract. */
function ref(key: string, column: boolean): SQL {
  return column ? sql`${sql.identifier(key)}` : sql`json_extract("data", ${`$.${key}`})`;
}

/** Wandelt einen Filterwert feldgerecht um (Datum → epoch s, boolean → 0/1). */
function coerce(field: Field, value: string | number | boolean): string | number {
  if (field.kind === 'date') {
    const d = typeof value === 'number' ? new Date(value) : new Date(String(value));
    return Math.floor(d.getTime() / 1000);
  }
  if (field.kind === 'boolean') return value === true || value === 'true' || value === 1 ? 1 : 0;
  if (field.kind === 'number') return typeof value === 'number' ? value : Number(value);
  return value as string | number;
}

function normalizeOps(value: WhereValue): WhereOperators {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  return { eq: value as string | number | boolean };
}

/**
 * Baut die WHERE-Bedingungen aus `where`. Unbekannte Felder und für den Field-Typ
 * unzulässige Operatoren werden übersprungen — die Query bleibt wohldefiniert.
 */
export function buildConditions(
  collection: CollectionConfig,
  columns: Set<string>,
  where: FindWhere,
): SQL[] {
  const conditions: SQL[] = [];
  for (const [key, raw] of Object.entries(where)) {
    const field = collection.fields[key];
    if (!field) continue;
    const allowed = OPERATORS_BY_KIND[field.kind] ?? ['eq'];
    const column = isColumn(field, columns, key);
    const col = ref(key, column);
    const ops = normalizeOps(raw);

    for (const op of allowed) {
      const v = ops[op];
      if (v === undefined) continue;
      switch (op) {
        case 'eq':
          conditions.push(sql`${col} = ${coerce(field, v as string | number | boolean)}`);
          break;
        case 'contains':
          conditions.push(sql`${col} LIKE ${`%${String(v)}%`}`);
          break;
        case 'in': {
          const list = (v as (string | number)[]).map((x) => coerce(field, x));
          if (list.length === 0) {
            conditions.push(sql`1 = 0`);
            break;
          }
          conditions.push(
            sql`${col} IN (${sql.join(
              list.map((x) => sql`${x}`),
              sql`, `,
            )})`,
          );
          break;
        }
        case 'gt':
          conditions.push(sql`${col} > ${coerce(field, v as string | number)}`);
          break;
        case 'lt':
          conditions.push(sql`${col} < ${coerce(field, v as string | number)}`);
          break;
        case 'gte':
          conditions.push(sql`${col} >= ${coerce(field, v as string | number)}`);
          break;
        case 'lte':
          conditions.push(sql`${col} <= ${coerce(field, v as string | number)}`);
          break;
        case 'between': {
          const [a, b] = v as [string | number, string | number];
          conditions.push(sql`${col} BETWEEN ${coerce(field, a)} AND ${coerce(field, b)}`);
          break;
        }
      }
    }
  }
  return conditions;
}

const RESERVED = new Set(['limit', 'offset', 'orderBy', 'order', 'include', 'q']);

/**
 * REST-Mapping (M2-5): `?where[status]=published&where[publishedAt][gt]=…&
 * orderBy=-publishedAt&include=tags,author&limit=10` → `FindOptions`. Akzeptiert
 * zusätzlich flache Feld-Filter (`?status=published`) als `eq` (Abwärtskompat M1).
 * `in`/`between` werden komma-separiert übergeben.
 */
export function parseFindQuery(
  collection: CollectionConfig,
  query: Record<string, string>,
): FindOptions {
  const where: FindWhere = {};
  const opts: FindOptions = {};

  for (const [rawKey, value] of Object.entries(query)) {
    if (rawKey === 'limit') {
      opts.limit = Number(value);
      continue;
    }
    if (rawKey === 'offset') {
      opts.offset = Number(value);
      continue;
    }
    if (rawKey === 'orderBy') {
      opts.orderBy = value;
      continue;
    }
    if (rawKey === 'include') {
      opts.include = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (RESERVED.has(rawKey)) continue;

    const match = /^where\[([^\]]+)\](?:\[([^\]]+)\])?$/.exec(rawKey);
    const field = match ? match[1] : rawKey;
    const op = match ? match[2] : undefined;
    if (!field || !collection.fields[field]) continue;

    if (!op) {
      where[field] = { eq: value };
    } else {
      where[field] ??= {};
      const existing = where[field] as WhereOperators;
      if (op === 'in') existing.in = value.split(',').map((s) => s.trim());
      else if (op === 'between') {
        const [a, b] = value.split(',').map((s) => s.trim());
        if (a !== undefined && b !== undefined) existing.between = [a, b];
      } else if (op === 'contains') existing.contains = value;
      else if (op === 'eq' || op === 'gt' || op === 'lt' || op === 'gte' || op === 'lte') {
        existing[op] = value;
      }
    }
  }

  if (Object.keys(where).length > 0) opts.where = where;
  return opts;
}

/** Zerlegt `orderBy` (`-publishedAt`) in Feld + Richtung; validiert gegen Felder. */
export function normalizeOrderBy(
  collection: CollectionConfig,
  columns: Set<string>,
  orderBy: string | undefined,
): { key: string; column: boolean; desc: boolean } | null {
  if (!orderBy) return null;
  const desc = orderBy.startsWith('-');
  const key = desc ? orderBy.slice(1) : orderBy;
  if (key === 'id') return { key, column: true, desc };
  if (!collection.fields[key]) return null;
  return { key, column: columns.has(key), desc };
}
