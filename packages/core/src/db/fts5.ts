/**
 * FTS5-Implementierung des `SearchAdapter`-Interfaces (M1-14). Pro Collection
 * wird eine FTS5-Virtuelle-Tabelle `<name>_fts` angelegt (lazy, IF NOT EXISTS).
 * Suche per `MATCH` mit bm25-Ranking. Funktioniert auf D1 und libSQL.
 */

import { sql } from 'drizzle-orm';
import type { CollectionConfig } from '../collections/index.js';
import type {
  DrizzleDatabase,
  SearchAdapter,
  SearchableDoc,
  SearchHit,
  SearchOpts,
} from '../platform/index.js';

/** Liefert die Keys aller Felder, die als `searchable: true` markiert sind. */
export function searchableFields(collection: CollectionConfig): string[] {
  return Object.entries(collection.fields)
    .filter(([, fieldDef]) => (fieldDef.options as { searchable?: boolean })?.searchable === true)
    .map(([key]) => key);
}

export interface Fts5AdapterOptions {
  /** Map Collection-Name -> searchable Field-Keys. */
  fieldsByCollection: Record<string, string[]>;
}

const ftsTable = (name: string) => `${name}_fts`;

// Identifier-Quoting für Spalten/Tabellen (alphanumerisch + _, kommt aus Konfig, trusted).
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function createFts5SearchAdapter(
  db: DrizzleDatabase,
  options: Fts5AdapterOptions,
): SearchAdapter {
  const ensured = new Set<string>();

  async function ensureTable(collection: string): Promise<string[] | null> {
    const fields = options.fieldsByCollection[collection];
    if (!fields || fields.length === 0) return null;
    if (!ensured.has(collection)) {
      const cols = ['id UNINDEXED', ...fields.map((f) => quoteIdent(f))].join(', ');
      await db.run(
        sql.raw(
          `CREATE VIRTUAL TABLE IF NOT EXISTS ${quoteIdent(ftsTable(collection))} USING fts5(${cols})`,
        ),
      );
      ensured.add(collection);
    }
    return fields;
  }

  function toIndexedString(value: unknown): string {
    if (value == null) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  return {
    async index(collection, id, doc) {
      const fields = await ensureTable(collection);
      if (!fields) return;
      const tableId = sql.identifier(ftsTable(collection));
      await db.run(sql`DELETE FROM ${tableId} WHERE id = ${id}`);
      const colSql = sql.join(
        ['id', ...fields].map((c) => sql.identifier(c)),
        sql`, `,
      );
      const valSql = sql.join(
        [id, ...fields.map((f) => toIndexedString((doc as SearchableDoc)[f]))].map(
          (v) => sql`${v}`,
        ),
        sql`, `,
      );
      await db.run(sql`INSERT INTO ${tableId} (${colSql}) VALUES (${valSql})`);
    },

    async remove(collection, id) {
      const fields = await ensureTable(collection);
      if (!fields) return;
      const tableId = sql.identifier(ftsTable(collection));
      await db.run(sql`DELETE FROM ${tableId} WHERE id = ${id}`);
    },

    async query(collection, q, opts: SearchOpts = {}): Promise<SearchHit[]> {
      const fields = await ensureTable(collection);
      if (!fields) return [];
      const tableId = sql.identifier(ftsTable(collection));
      const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
      const offset = Math.max(opts.offset ?? 0, 0);
      const rows = (await db.all(
        sql`SELECT id, bm25(${tableId}) AS rank FROM ${tableId} WHERE ${tableId} MATCH ${q} ORDER BY rank LIMIT ${limit} OFFSET ${offset}`,
      )) as Array<{ id: string; rank: number }>;
      // bm25: niedriger = relevanter; wir geben einen positiven Score zurück.
      return rows.map((r) => ({ id: r.id, score: -r.rank }));
    },
  };
}
