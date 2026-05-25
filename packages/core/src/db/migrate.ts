/**
 * Migrations-Generator (M1-2). Aus den abgeleiteten Tabellen (M1-1) entsteht
 * deterministisches SQL (CREATE TABLE + Indizes, generierte Spalten via
 * json_extract). Idempotenz über einen Snapshot: unveränderte Definitionen
 * erzeugen keine neue Migration.
 */

import type { CollectionConfig } from '../collections/index.js';
import { type ColumnDefault, type DerivedColumn, type DerivedTable, deriveTable } from './table.js';

export interface TableSql {
  createTable: string;
  createIndexes: string[];
}

export type MigrationSnapshot = DerivedTable[];

export interface GeneratedMigration {
  /** SQL der Migration, oder `null`, wenn sich gegenüber `previous` nichts geändert hat. */
  sql: string | null;
  snapshot: MigrationSnapshot;
}

function defaultSql(value: ColumnDefault): string {
  if (typeof value === 'object') return '(unixepoch())';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

function columnSql(column: DerivedColumn): string {
  if (column.generatedFrom) {
    return `"${column.name}" ${column.type} GENERATED ALWAYS AS (json_extract("data", '${column.generatedFrom}')) VIRTUAL`;
  }
  const parts = [`"${column.name}"`, column.type];
  if (column.primaryKey) parts.push('PRIMARY KEY');
  if (column.notNull) parts.push('NOT NULL');
  if (column.default !== undefined) parts.push(`DEFAULT ${defaultSql(column.default)}`);
  return parts.join(' ');
}

/** SQL (CREATE TABLE + Indizes) für eine abgeleitete Tabelle. */
export function tableToSql(table: DerivedTable): TableSql {
  // Generierte Spalten zuletzt, damit sie die `data`-Spalte referenzieren können.
  const ordered = [
    ...table.columns.filter((c) => !c.generatedFrom),
    ...table.columns.filter((c) => c.generatedFrom),
  ];
  const createTable = `CREATE TABLE "${table.name}" (\n  ${ordered.map(columnSql).join(',\n  ')}\n);`;
  const createIndexes = table.indexes.map(
    (index) =>
      `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX "${index.name}" ON "${table.name}" (${index.columns
        .map((c) => `"${c}"`)
        .join(', ')});`,
  );
  return { createTable, createIndexes };
}

/** Deterministischer Snapshot der abgeleiteten Tabellen einer Collection-Menge. */
export function migrationSnapshot(collections: CollectionConfig[]): MigrationSnapshot {
  return collections.map(deriveTable);
}

/**
 * Erzeugt die SQL-Migration für die Collections. Stimmt der Snapshot mit
 * `previous` überein, ist das Ergebnis ein No-op (`sql: null`).
 */
export function generateMigration(
  collections: CollectionConfig[],
  previous?: MigrationSnapshot,
): GeneratedMigration {
  const snapshot = migrationSnapshot(collections);
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) {
    return { sql: null, snapshot };
  }
  const sql = snapshot
    .map((table) => {
      const { createTable, createIndexes } = tableToSql(table);
      return [createTable, ...createIndexes].join('\n');
    })
    .join('\n\n');
  return { sql, snapshot };
}
