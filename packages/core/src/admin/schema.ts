/**
 * Serialisierbares Admin-Schema aus einer CollectionConfig.
 * Enthält nur Daten (keine Funktionen), sodass es als Astro-Prop an Svelte-Islands
 * übergeben werden kann. Speist CollectionForm und CollectionTable (ARCHITECTURE §8).
 */

import type { CollectionConfig } from '../collections/index.js';
import type { FieldType } from '../fields/index.js';

export interface AdminFieldOptions {
  values?: string[];
  from?: string;
  accept?: string;
  max?: number;
  min?: number;
  many?: boolean;
  to?: string;
}

export interface AdminField {
  name: string;
  kind: FieldType;
  label: string;
  required: boolean;
  options: AdminFieldOptions;
}

export interface AdminCollectionSchema {
  name: string;
  singular: string;
  plural: string;
  fields: AdminField[];
  apiBase: string;
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).replace(/_/g, ' ');
}

export function adminSchema(
  collection: CollectionConfig,
  apiBase?: string,
): AdminCollectionSchema {
  const base = apiBase ?? `/api/internal/content/${collection.name}`;
  const fields: AdminField[] = Object.entries(collection.fields).map(([name, f]) => {
    const opts = (f.options ?? {}) as Record<string, unknown>;
    return {
      name,
      kind: f.kind,
      label: humanize(name),
      required: Boolean(opts.required),
      options: {
        values: Array.isArray(opts.values) ? (opts.values as string[]) : undefined,
        from: typeof opts.from === 'string' ? opts.from : undefined,
        accept: typeof opts.accept === 'string' ? opts.accept : undefined,
        max: typeof opts.max === 'number' ? opts.max : undefined,
        min: typeof opts.min === 'number' ? opts.min : undefined,
        many: typeof opts.many === 'boolean' ? opts.many : undefined,
        to: typeof opts.to === 'string' ? opts.to : undefined,
      },
    };
  });

  return {
    name: collection.name,
    singular: collection.labels?.singular ?? collection.name,
    plural: collection.labels?.plural ?? `${collection.name}s`,
    fields,
    apiBase: base,
  };
}
