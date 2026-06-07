/**
 * Generisches Repository über das Hybrid-Schema (M1-4). Spaltenfelder und die
 * JSON-Spalte `data` werden beim Schreiben getrennt und beim Lesen wieder
 * zusammengeführt. Einzige Schicht mit SQL — Routen/Services bleiben dünn.
 */

import { type SQL, sql } from 'drizzle-orm';
import type { CollectionConfig } from '../collections/index.js';
import type { DrizzleDatabase } from '../platform/index.js';
import { buildConditions, type FindOptions, normalizeOrderBy } from './query.js';
import { deriveTable } from './table.js';

type Row = Record<string, unknown>;

export interface ListOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
  where?: Record<string, string>;
  publishedOnly?: boolean;
}

export interface CollectionRepository {
  list(opts?: ListOptions): Promise<Row[]>;
  /** Typsicherer Query-Layer (M2-5): where-Operatoren + orderBy + Pagination. */
  find(opts?: FindOptions): Promise<Row[]>;
  get(id: string, opts?: { publishedOnly?: boolean }): Promise<Row | null>;
  /** Lädt mehrere Datensätze in einer Abfrage (Relation-Auflösung, kein N+1). */
  byIds(ids: string[]): Promise<Row[]>;
  create(values: Row): Promise<Row>;
  update(id: string, patch: Row): Promise<Row | null>;
  remove(id: string): Promise<boolean>;
}

export function collectionRepository(
  db: DrizzleDatabase,
  collection: CollectionConfig,
): CollectionRepository {
  const table = deriveTable(collection);
  const tableId = sql.identifier(table.name);
  const columnFields = new Set(
    table.columns
      .filter((c) => !c.generatedFrom && c.name !== 'id' && c.name !== 'data')
      .map((c) => c.name),
  );
  const kinds: Record<string, string> = {};
  for (const [key, field] of Object.entries(collection.fields)) kinds[key] = field.kind;
  const fieldKeys = Object.keys(collection.fields);
  const hasStatus = columnFields.has('status');

  function serialize(value: unknown): unknown {
    if (value instanceof Date) return Math.floor(value.getTime() / 1000);
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value ?? null;
  }

  function deserialize(key: string, value: unknown): unknown {
    if (value == null) return value;
    if (kinds[key] === 'date') return new Date(Number(value) * 1000).toISOString();
    if (kinds[key] === 'boolean') return Boolean(value);
    return value;
  }

  function toRecord(row: Row): Row {
    const data = row.data ? (JSON.parse(String(row.data)) as Row) : {};
    const record: Row = { id: row.id };
    for (const key of fieldKeys) {
      record[key] = columnFields.has(key) ? deserialize(key, row[key]) : data[key];
    }
    return record;
  }

  function split(values: Row): { columns: Row; data: Row } {
    const columns: Row = {};
    const data: Row = {};
    for (const key of fieldKeys) {
      if (!(key in values)) continue;
      if (columnFields.has(key)) columns[key] = values[key];
      else data[key] = values[key];
    }
    return { columns, data };
  }

  async function selectById(id: string, publishedOnly = false): Promise<Row | null> {
    const cond: SQL[] = [sql`"id" = ${id}`];
    if (publishedOnly && hasStatus) cond.push(sql`"status" = 'published'`);
    const rows = (await db.all(
      sql`SELECT * FROM ${tableId} WHERE ${sql.join(cond, sql` AND `)} LIMIT 1`,
    )) as Row[];
    return rows[0] ? toRecord(rows[0]) : null;
  }

  return {
    async list(opts = {}) {
      const cond: SQL[] = [];
      if (opts.publishedOnly && hasStatus) cond.push(sql`"status" = 'published'`);
      for (const [key, value] of Object.entries(opts.where ?? {})) {
        cond.push(
          columnFields.has(key)
            ? sql`${sql.identifier(key)} = ${value}`
            : sql`json_extract("data", ${`$.${key}`}) = ${value}`,
        );
      }
      const whereSql = cond.length ? sql` WHERE ${sql.join(cond, sql` AND `)}` : sql``;
      const orderable = opts.orderBy && (columnFields.has(opts.orderBy) || opts.orderBy === 'id');
      const orderId = sql.identifier(orderable ? (opts.orderBy as string) : 'id');
      const dir = opts.order === 'desc' ? sql`DESC` : sql`ASC`;
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
      const offset = Math.max(opts.offset ?? 0, 0);
      const rows = (await db.all(
        sql`SELECT * FROM ${tableId}${whereSql} ORDER BY ${orderId} ${dir} LIMIT ${limit} OFFSET ${offset}`,
      )) as Row[];
      return rows.map(toRecord);
    },

    async find(opts = {}) {
      const cond: SQL[] = [];
      if (opts.publishedOnly && hasStatus) cond.push(sql`"status" = 'published'`);
      if (opts.where) cond.push(...buildConditions(collection, columnFields, opts.where));
      const whereSql = cond.length ? sql` WHERE ${sql.join(cond, sql` AND `)}` : sql``;
      const ob = normalizeOrderBy(collection, columnFields, opts.orderBy);
      const orderRef = ob
        ? ob.column
          ? sql.identifier(ob.key)
          : sql`json_extract("data", ${`$.${ob.key}`})`
        : sql.identifier('id');
      const dir = ob?.desc ? sql`DESC` : sql`ASC`;
      const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
      const offset = Math.max(opts.offset ?? 0, 0);
      const rows = (await db.all(
        sql`SELECT * FROM ${tableId}${whereSql} ORDER BY ${orderRef} ${dir} LIMIT ${limit} OFFSET ${offset}`,
      )) as Row[];
      return rows.map(toRecord);
    },

    get(id, opts = {}) {
      return selectById(id, opts.publishedOnly);
    },

    async byIds(ids) {
      const unique = [...new Set(ids)].filter((id) => typeof id === 'string');
      if (unique.length === 0) return [];
      const list = sql.join(
        unique.map((id) => sql`${id}`),
        sql`, `,
      );
      const rows = (await db.all(sql`SELECT * FROM ${tableId} WHERE "id" IN (${list})`)) as Row[];
      return rows.map(toRecord);
    },

    async create(values) {
      const id = typeof values.id === 'string' ? values.id : crypto.randomUUID();
      const { columns, data } = split(values);
      const names = ['id', ...Object.keys(columns), 'data'];
      const values_ = [id, ...Object.values(columns).map(serialize), JSON.stringify(data)];
      const colSql = sql.join(
        names.map((n) => sql.identifier(n)),
        sql`, `,
      );
      const valSql = sql.join(
        values_.map((v) => sql`${v}`),
        sql`, `,
      );
      await db.run(sql`INSERT INTO ${tableId} (${colSql}) VALUES (${valSql})`);
      return (await selectById(id)) as Row;
    },

    async update(id, patch) {
      const existing = await selectById(id);
      if (!existing) return null;
      const { columns, data } = split(patch);
      const sets: SQL[] = [];
      for (const [key, value] of Object.entries(columns)) {
        sets.push(sql`${sql.identifier(key)} = ${serialize(value)}`);
      }
      if (Object.keys(data).length > 0) {
        const merged: Row = {};
        for (const key of fieldKeys) {
          if (!columnFields.has(key) && key in existing) merged[key] = existing[key];
        }
        Object.assign(merged, data);
        sets.push(sql`"data" = ${JSON.stringify(merged)}`);
      }
      if (sets.length === 0) return existing;
      await db.run(sql`UPDATE ${tableId} SET ${sql.join(sets, sql`, `)} WHERE "id" = ${id}`);
      return selectById(id);
    },

    async remove(id) {
      const existing = await selectById(id);
      if (!existing) return false;
      await db.run(sql`DELETE FROM ${tableId} WHERE "id" = ${id}`);
      return true;
    },
  };
}
