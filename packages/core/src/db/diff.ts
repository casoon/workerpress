/**
 * Schema-Versionierung und Breaking-Change-Check (M1-13). Erfasst pro Collection
 * Feld-Optionen (max/min/required/unique/enum-Werte/relation.many/...) und
 * klassifiziert Änderungen als additiv oder breaking.
 */

import type { CollectionConfig } from '../collections/index.js';

export interface FieldSnapshot {
  kind: string;
  options: Record<string, unknown>;
}

export interface CollectionSnapshot {
  name: string;
  version: number;
  fields: Record<string, FieldSnapshot>;
}

export type SchemaSnapshot = CollectionSnapshot[];

export interface SchemaChange {
  collection: string;
  field?: string;
  kind: 'additive' | 'breaking';
  description: string;
}

/** Serialisiert die Collections in einen vergleichbaren Schema-Snapshot. */
export function collectionSnapshot(collections: CollectionConfig[]): SchemaSnapshot {
  return collections.map((collection) => ({
    name: collection.name,
    version: collection.version ?? 1,
    fields: Object.fromEntries(
      Object.entries(collection.fields).map(([key, fieldDef]) => [
        key,
        {
          kind: fieldDef.kind,
          options: { ...(fieldDef.options as Record<string, unknown>) },
        },
      ]),
    ),
  }));
}

function getNum(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  return typeof v === 'number' ? v : undefined;
}

function getBool(o: Record<string, unknown>, k: string): boolean {
  return o[k] === true;
}

function getString(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === 'string' ? v : undefined;
}

function getValues(o: Record<string, unknown>): readonly string[] {
  const v = o.values;
  return Array.isArray(v) ? (v as string[]) : [];
}

function diffOptions(
  collection: string,
  field: string,
  kind: string,
  prev: Record<string, unknown>,
  curr: Record<string, unknown>,
): SchemaChange[] {
  const changes: SchemaChange[] = [];

  const prevMax = getNum(prev, 'max');
  const currMax = getNum(curr, 'max');
  if (prevMax !== currMax) {
    const narrowed =
      typeof currMax === 'number' &&
      (prevMax === undefined || (typeof prevMax === 'number' && currMax < prevMax));
    changes.push({
      collection,
      field,
      kind: narrowed ? 'breaking' : 'additive',
      description: `max: ${prevMax ?? '∞'} -> ${currMax ?? '∞'}`,
    });
  }

  const prevMin = getNum(prev, 'min');
  const currMin = getNum(curr, 'min');
  if (prevMin !== currMin) {
    const raised =
      typeof currMin === 'number' &&
      (prevMin === undefined || (typeof prevMin === 'number' && currMin > prevMin));
    changes.push({
      collection,
      field,
      kind: raised ? 'breaking' : 'additive',
      description: `min: ${prevMin ?? 0} -> ${currMin ?? 0}`,
    });
  }

  const prevReq = getBool(prev, 'required');
  const currReq = getBool(curr, 'required');
  if (prevReq !== currReq) {
    changes.push({
      collection,
      field,
      kind: currReq && !prevReq ? 'breaking' : 'additive',
      description: `required: ${prevReq} -> ${currReq}`,
    });
  }

  const prevUnique = getBool(prev, 'unique');
  const currUnique = getBool(curr, 'unique');
  if (prevUnique !== currUnique) {
    changes.push({
      collection,
      field,
      kind: currUnique && !prevUnique ? 'breaking' : 'additive',
      description: `unique: ${prevUnique} -> ${currUnique}`,
    });
  }

  if (kind === 'relation') {
    const prevMany = getBool(prev, 'many');
    const currMany = getBool(curr, 'many');
    if (prevMany !== currMany) {
      changes.push({
        collection,
        field,
        kind: 'breaking',
        description: `relation.many: ${prevMany} -> ${currMany}`,
      });
    }
    const prevTo = getString(prev, 'to');
    const currTo = getString(curr, 'to');
    if (prevTo !== currTo) {
      changes.push({
        collection,
        field,
        kind: 'breaking',
        description: `relation.to: ${prevTo} -> ${currTo}`,
      });
    }
  }

  if (kind === 'enum') {
    const prevValues = getValues(prev);
    const currValues = getValues(curr);
    const removed = prevValues.filter((v) => !currValues.includes(v));
    const added = currValues.filter((v) => !prevValues.includes(v));
    if (removed.length > 0) {
      changes.push({
        collection,
        field,
        kind: 'breaking',
        description: `enum values removed: ${removed.join(', ')}`,
      });
    }
    if (added.length > 0) {
      changes.push({
        collection,
        field,
        kind: 'additive',
        description: `enum values added: ${added.join(', ')}`,
      });
    }
  }

  return changes;
}

/** Klassifiziert die Änderungen zwischen zwei Schema-Snapshots. */
export function diffCollections(previous: SchemaSnapshot, current: SchemaSnapshot): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const prevByName = new Map(previous.map((c) => [c.name, c]));
  const currByName = new Map(current.map((c) => [c.name, c]));

  for (const c of current) {
    if (!prevByName.has(c.name)) {
      changes.push({ collection: c.name, kind: 'additive', description: 'collection added' });
    }
  }
  for (const c of previous) {
    if (!currByName.has(c.name)) {
      changes.push({ collection: c.name, kind: 'breaking', description: 'collection removed' });
    }
  }

  for (const curr of current) {
    const prev = prevByName.get(curr.name);
    if (!prev) continue;

    for (const fieldKey of Object.keys(curr.fields)) {
      if (!(fieldKey in prev.fields)) {
        changes.push({
          collection: curr.name,
          field: fieldKey,
          kind: 'additive',
          description: 'field added',
        });
      }
    }
    for (const fieldKey of Object.keys(prev.fields)) {
      const prevField = prev.fields[fieldKey];
      const currField = curr.fields[fieldKey];
      if (!currField || !prevField) {
        if (prevField && !currField) {
          changes.push({
            collection: curr.name,
            field: fieldKey,
            kind: 'breaking',
            description: 'field removed',
          });
        }
        continue;
      }
      if (prevField.kind !== currField.kind) {
        changes.push({
          collection: curr.name,
          field: fieldKey,
          kind: 'breaking',
          description: `field kind: ${prevField.kind} -> ${currField.kind}`,
        });
        continue;
      }
      changes.push(
        ...diffOptions(curr.name, fieldKey, currField.kind, prevField.options, currField.options),
      );
    }
  }

  // Bei Breaking-Changes ohne Version-Bump zusätzlich warnen.
  for (const curr of current) {
    const prev = prevByName.get(curr.name);
    if (!prev) continue;
    const hasBreaking = changes.some((c) => c.collection === curr.name && c.kind === 'breaking');
    if (hasBreaking && curr.version <= prev.version) {
      changes.push({
        collection: curr.name,
        kind: 'breaking',
        description: `breaking change(s) detected — bump \`version\` from ${prev.version} (currently ${curr.version})`,
      });
    }
  }

  return changes;
}
