/**
 * `cms inspect` (M1-12): sichtbar machen, was die DSL generiert — Tabelle,
 * Indizes, Zod-Schemas, REST-Routen, nächste Migration. Pflicht-Feature: keine
 * Blackbox (ARCHITECTURE §5).
 */

import type { CollectionConfig } from '../collections/index.js';
import { generateMigration, type MigrationSnapshot } from '../db/migrate.js';
import { deriveTable } from '../db/table.js';
import { collectionSchemas } from '../schema/zod.js';

export type InspectTarget = 'all' | 'routes' | 'schema' | 'migrations';

export interface InspectOptions {
  collection?: string;
  target?: InspectTarget;
  previousSnapshot?: MigrationSnapshot;
}

function describeShape(schema: { shape?: Record<string, unknown> }): string {
  const keys = schema.shape ? Object.keys(schema.shape) : [];
  return keys.length > 0 ? keys.join(', ') : '(empty)';
}

function formatSchema(collection: CollectionConfig): string {
  const table = deriveTable(collection);
  const schemas = collectionSchemas(collection);
  const lines = [`# Collection: ${collection.name}`, '', '## Table'];
  for (const column of table.columns) {
    const parts = [column.name, column.type];
    if (column.primaryKey) parts.push('PK');
    if (column.notNull) parts.push('NOT NULL');
    if (column.default !== undefined) parts.push(`default=${JSON.stringify(column.default)}`);
    if (column.generatedFrom) parts.push(`generated(${column.generatedFrom})`);
    lines.push(`  - ${parts.join(' ')}`);
  }
  if (table.indexes.length > 0) {
    lines.push('', '## Indexes');
    for (const index of table.indexes) {
      lines.push(`  - ${index.unique ? 'UNIQUE ' : ''}${index.name}(${index.columns.join(',')})`);
    }
  }
  lines.push(
    '',
    '## Zod schemas',
    `  insert: ${describeShape(schemas.insert as { shape?: Record<string, unknown> })}`,
    `  update: ${describeShape(schemas.update as { shape?: Record<string, unknown> })}`,
    `  select: ${describeShape(schemas.select as { shape?: Record<string, unknown> })}`,
  );
  return lines.join('\n');
}

function formatRoutes(collection: CollectionConfig): string {
  const n = collection.name;
  return [
    `## REST routes for ${n}`,
    `  GET    /api/content/${n}`,
    `  GET    /api/content/${n}/:id`,
    `  GET    /api/internal/content/${n}`,
    `  GET    /api/internal/content/${n}/:id`,
    `  POST   /api/internal/content/${n}`,
    `  PUT    /api/internal/content/${n}/:id`,
    `  DELETE /api/internal/content/${n}/:id`,
  ].join('\n');
}

function formatMigration(sql: string | null, label: string): string {
  if (!sql) return `## Migration (${label})\n  no changes`;
  const indented = sql
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return `## Migration (${label})\n${indented}`;
}

/** Liefert eine menschenlesbare Beschreibung der generierten Realität. */
export function inspect(collections: CollectionConfig[], opts: InspectOptions = {}): string {
  const target: InspectTarget = opts.target ?? 'all';
  const filtered = opts.collection
    ? collections.filter((c) => c.name === opts.collection)
    : collections;

  if (opts.collection && filtered.length === 0) {
    return `Unknown collection: ${opts.collection}`;
  }

  const sections: string[] = [];
  for (const collection of filtered) {
    if (target === 'all' || target === 'schema') sections.push(formatSchema(collection));
    if (target === 'all' || target === 'routes') sections.push(formatRoutes(collection));
  }
  if (target === 'all' || target === 'migrations') {
    const { sql } = generateMigration(filtered, opts.previousSnapshot);
    sections.push(formatMigration(sql, opts.previousSnapshot ? 'next vs snapshot' : 'initial'));
  }
  return sections.join('\n\n');
}
