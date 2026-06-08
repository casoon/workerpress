/**
 * `cms inspect` (M1-12): sichtbar machen, was die DSL generiert — Tabelle,
 * Indizes, Zod-Schemas, REST-Routen, nächste Migration. Pflicht-Feature: keine
 * Blackbox (ARCHITECTURE §5).
 */

import { adminSchema } from '../admin/schema.js';
import type { CollectionConfig } from '../collections/index.js';
import {
  collectionSnapshot,
  diffCollections,
  type SchemaChange,
  type SchemaSnapshot,
} from '../db/diff.js';
import { searchableFields } from '../db/fts5.js';
import { generateMigration, type MigrationSnapshot } from '../db/migrate.js';
import { deriveTable } from '../db/table.js';
import { collectionSchemas } from '../schema/zod.js';

export type InspectTarget =
  | 'all'
  | 'routes'
  | 'schema'
  | 'migrations'
  | 'hooks'
  | 'policies'
  | 'forms'
  | 'search';

export interface InspectOptions {
  collection?: string;
  target?: InspectTarget;
  previousSnapshot?: MigrationSnapshot;
  /** Vorheriger Schema-Snapshot für die Klassifikation additiv vs. breaking (M1-13). */
  previousSchemaSnapshot?: SchemaSnapshot;
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

function formatHooks(collection: CollectionConfig): string {
  const hooks = collection.hooks ?? {};
  const lines = [`## Hooks for ${collection.name}`];
  for (const phase of ['beforeChange', 'afterChange'] as const) {
    const entries = hooks[phase] ?? [];
    if (entries.length === 0) {
      lines.push(`  ${phase}: none`);
      continue;
    }
    // In Ausführungsreihenfolge (aufsteigend nach priority, stabil) anzeigen.
    const described = entries
      .map((entry, order) =>
        typeof entry === 'function'
          ? { name: entry.name || 'anonymous', priority: 0, order }
          : { name: entry.handler.name || 'anonymous', priority: entry.priority ?? 0, order },
      )
      .sort((a, b) => a.priority - b.priority || a.order - b.order)
      .map((h) => `${h.name}(priority=${h.priority})`);
    lines.push(`  ${phase}: ${described.join(', ')}`);
  }
  return lines.join('\n');
}

function formatPolicies(collection: CollectionConfig): string {
  const access = collection.access ?? {};
  const read = access.read?.name ?? 'public';
  const write = access.write?.name ?? 'auth (no policy)';
  return [`## Policies for ${collection.name}`, `  read: ${read}`, `  write: ${write}`].join('\n');
}

function formatForms(collection: CollectionConfig): string {
  const schema = adminSchema(collection);
  const lines = [`## Admin form for ${collection.name}`, `  apiBase: ${schema.apiBase}`];
  for (const f of schema.fields) {
    const flags = [f.required ? 'required' : '', f.options.to ? `-> ${f.options.to}` : '']
      .filter(Boolean)
      .join(' ');
    lines.push(`  - ${f.label} (${f.kind})${flags ? ` ${flags}` : ''}`);
  }
  return lines.join('\n');
}

function formatSearch(collection: CollectionConfig): string {
  const fields = searchableFields(collection);
  return `## Search fields for ${collection.name}\n  ${fields.length ? fields.join(', ') : 'none'}`;
}

function formatMigration(sql: string | null, label: string): string {
  if (!sql) return `## Migration (${label})\n  no changes`;
  const indented = sql
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return `## Migration (${label})\n${indented}`;
}

function formatChanges(changes: SchemaChange[]): string {
  if (changes.length === 0) return '## Schema changes\n  none';
  const lines = ['## Schema changes'];
  for (const change of changes) {
    const marker = change.kind === 'breaking' ? '⚠ BREAKING' : '✓ additive';
    const subject = change.field ? `${change.collection}.${change.field}` : change.collection;
    lines.push(`  ${marker} [${subject}] ${change.description}`);
  }
  return lines.join('\n');
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
    if (target === 'all' || target === 'hooks') sections.push(formatHooks(collection));
    if (target === 'all' || target === 'policies') sections.push(formatPolicies(collection));
    if (target === 'all' || target === 'forms') sections.push(formatForms(collection));
    if (target === 'all' || target === 'search') sections.push(formatSearch(collection));
  }
  if (target === 'all' || target === 'migrations') {
    // Bei Collection-Filter auch die Snapshots auf dieselbe Auswahl reduzieren,
    // damit andere Collections nicht fälschlich als „entfernt" auftauchen.
    const prevMigration = opts.collection
      ? opts.previousSnapshot?.filter((t) => t.name === opts.collection)
      : opts.previousSnapshot;
    const { sql } = generateMigration(filtered, prevMigration);
    sections.push(formatMigration(sql, opts.previousSnapshot ? 'next vs snapshot' : 'initial'));

    if (opts.previousSchemaSnapshot) {
      const prevSchema = opts.collection
        ? opts.previousSchemaSnapshot.filter((c) => c.name === opts.collection)
        : opts.previousSchemaSnapshot;
      const changes = diffCollections(prevSchema, collectionSnapshot(filtered));
      sections.push(formatChanges(changes));
    }
  }
  return sections.join('\n\n');
}
