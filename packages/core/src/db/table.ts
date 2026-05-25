/**
 * Field-System -> DB-Mapping (Hybrid-Schema, ARCHITECTURE §4/§5).
 *
 * Stabile, skalare Felder werden eigene Spalten; flexible/strukturierte Felder
 * leben in der JSON-Spalte `data`. `indexed`/`unique` erzeugen einen Index — bei
 * JSON-Feldern über eine generierte Spalte (json_extract). Das Ergebnis ist eine
 * deterministische, beschriebene Tabellen-Struktur (genutzt von Migrationen und
 * `cms inspect`).
 */

import type { CollectionConfig } from '../collections/index.js';
import type { Field } from '../fields/index.js';

export type SqliteType = 'text' | 'integer' | 'real';

export type ColumnDefault = string | number | boolean | { now: true };

export interface DerivedColumn {
  name: string;
  type: SqliteType;
  notNull: boolean;
  primaryKey?: boolean;
  default?: ColumnDefault;
  /** Aus `data` generierte Spalte: json_extract-Pfad, z. B. `$.author`. */
  generatedFrom?: string;
}

export interface DerivedIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface DerivedTable {
  name: string;
  columns: DerivedColumn[];
  indexes: DerivedIndex[];
  /** Name der JSON-Spalte für flexible Feldwerte. */
  jsonColumn: string;
}

interface RawFieldOptions {
  required?: boolean;
  indexed?: boolean;
  unique?: boolean;
  many?: boolean;
  default?: unknown;
}

/** Skalare, „stabile" Field-Typen -> eigene Spalte (SQLite-Storage-Klasse). */
const COLUMN_TYPES: Record<string, SqliteType> = {
  text: 'text',
  slug: 'text',
  enum: 'text',
  email: 'text',
  url: 'text',
  number: 'real',
  boolean: 'integer',
  date: 'integer',
};

function options(field: Field): RawFieldOptions {
  return (field.options ?? {}) as RawFieldOptions;
}

/** Eigene Spalte (true) oder JSON `data` (false). Relationen nur einwertig als Spalte. */
function isColumnField(field: Field): boolean {
  if (field.kind === 'relation') return !options(field).many;
  return field.kind in COLUMN_TYPES;
}

function sqliteType(field: Field): SqliteType {
  if (field.kind === 'relation') return 'text';
  return COLUMN_TYPES[field.kind] ?? 'text';
}

function columnDefault(field: Field): ColumnDefault | undefined {
  const value = options(field).default;
  if (field.kind === 'date' && value === 'now') return { now: true };
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

/** Leitet aus einer Collection-Definition deterministisch die Tabellen-Struktur ab. */
export function deriveTable(collection: CollectionConfig): DerivedTable {
  const columns: DerivedColumn[] = [{ name: 'id', type: 'text', notNull: true, primaryKey: true }];
  const indexes: DerivedIndex[] = [];

  for (const [key, field] of Object.entries(collection.fields)) {
    const opts = options(field);
    const indexed = Boolean(opts.indexed || opts.unique);

    if (isColumnField(field)) {
      columns.push({
        name: key,
        type: sqliteType(field),
        notNull: Boolean(opts.required),
        default: columnDefault(field),
      });
      if (indexed) {
        indexes.push({
          name: `${collection.name}_${key}_idx`,
          columns: [key],
          unique: Boolean(opts.unique),
        });
      }
    } else if (indexed) {
      // Flexibles Feld liegt in `data`; für den Index eine generierte Spalte ableiten.
      columns.push({
        name: key,
        type: sqliteType(field),
        notNull: false,
        generatedFrom: `$.${key}`,
      });
      indexes.push({
        name: `${collection.name}_${key}_idx`,
        columns: [key],
        unique: Boolean(opts.unique),
      });
    }
    // andernfalls: Feld liegt ausschließlich in der JSON-Spalte `data`.
  }

  columns.push({ name: 'data', type: 'text', notNull: true, default: '{}' });

  return { name: collection.name, columns, indexes, jsonColumn: 'data' };
}
