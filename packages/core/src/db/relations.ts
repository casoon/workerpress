/**
 * Relation-Auflösung (M2-4) — `field.relation({ to })` speichert IDs (single als
 * Spalte, many als JSON-Array in `data`). Diese Helfer lösen die referenzierten
 * Datensätze auf: ein Batch-Query pro Relation (kein N+1). Tiefe auf 1 begrenzt,
 * d. h. aufgelöste Datensätze werden nicht weiter expandiert. Siehe ARCHITECTURE §9.
 */

import type { CollectionConfig } from '../collections/index.js';
import type { DrizzleDatabase } from '../platform/index.js';
import { collectionRepository } from './repository.js';

type Row = Record<string, unknown>;

/** Registry: Collection-Name → Definition (First-Party + Plugins). */
export type CollectionRegistry = Record<string, CollectionConfig>;

export function buildRegistry(collections: CollectionConfig[]): CollectionRegistry {
  const registry: CollectionRegistry = {};
  for (const c of collections) registry[c.name] = c;
  return registry;
}

interface RelationInfo {
  key: string;
  to: string;
  many: boolean;
}

/** Liefert die in `include` angeforderten, tatsächlich existierenden Relationen. */
function relationsFor(collection: CollectionConfig, include: string[]): RelationInfo[] {
  const infos: RelationInfo[] = [];
  for (const key of include) {
    const field = collection.fields[key];
    if (!field || field.kind !== 'relation') continue;
    const opts = field.options as { to: string; many?: boolean };
    infos.push({ key, to: opts.to, many: Boolean(opts.many) });
  }
  return infos;
}

/**
 * Ersetzt in `rows` die in `include` genannten Relation-Felder durch die
 * aufgelösten Zieldatensätze (single → Objekt|null, many → Objekt-Array).
 * Pro Relation genau eine `byIds`-Abfrage. Unbekannte/Nicht-Relation-Keys werden
 * ignoriert; fehlt ein Ziel, bleibt der Wert null bzw. wird aus dem Array entfernt.
 */
export async function resolveIncludes(
  db: DrizzleDatabase,
  collection: CollectionConfig,
  rows: Row[],
  include: string[],
  registry: CollectionRegistry,
): Promise<Row[]> {
  if (rows.length === 0 || include.length === 0) return rows;
  const relations = relationsFor(collection, include);

  for (const rel of relations) {
    const target = registry[rel.to];
    if (!target) continue;

    // Alle referenzierten IDs über alle Zeilen sammeln (ein Batch-Query).
    const ids: string[] = [];
    for (const row of rows) {
      const value = row[rel.key];
      if (rel.many) {
        if (Array.isArray(value)) for (const v of value) if (typeof v === 'string') ids.push(v);
      } else if (typeof value === 'string') {
        ids.push(value);
      }
    }
    if (ids.length === 0) continue;

    const resolved = await collectionRepository(db, target).byIds(ids);
    const byId = new Map(resolved.map((r) => [r.id as string, r]));

    for (const row of rows) {
      const value = row[rel.key];
      if (rel.many) {
        row[rel.key] = Array.isArray(value)
          ? value.map((v) => byId.get(v as string)).filter((r): r is Row => Boolean(r))
          : [];
      } else {
        row[rel.key] = typeof value === 'string' ? (byId.get(value) ?? null) : null;
      }
    }
  }

  return rows;
}

/** Parst den REST-`include`-Parameter (`?include=author,tags`) zu Field-Keys. */
export function parseInclude(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
