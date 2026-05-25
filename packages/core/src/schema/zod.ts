/**
 * Field-System -> Zod-Schemas (M1-3). Pro Collection entstehen `insert`,
 * `update` (partial) und `select` Schemas. Speist Routen-Validierung, OpenAPI
 * und Admin-Form (ARCHITECTURE §5).
 */

import { z } from 'zod';
import type { CollectionConfig } from '../collections/index.js';
import type { Field } from '../fields/index.js';

interface RawFieldOptions {
  required?: boolean;
  many?: boolean;
  max?: number;
  min?: number;
  default?: unknown;
  values?: string[];
}

function options(field: Field): RawFieldOptions {
  return (field.options ?? {}) as RawFieldOptions;
}

/** Basis-Validator je Field-Typ (ohne required/optional). */
function fieldSchema(field: Field): z.ZodTypeAny {
  const o = options(field);
  switch (field.kind) {
    case 'text':
    case 'markdown': {
      let s = z.string();
      if (typeof o.max === 'number') s = s.max(o.max);
      if (typeof o.min === 'number') s = s.min(o.min);
      return s;
    }
    case 'slug':
      return z.string().min(1);
    case 'email':
      return z.email();
    case 'url':
      return z.url();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'date':
      return z.coerce.date();
    case 'enum': {
      const values = o.values ?? [];
      return values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string();
    }
    case 'relation':
      return o.many ? z.array(z.string()) : z.string();
    case 'array':
      return z.array(z.unknown());
    default:
      // richText, json, media, group: strukturiert -> nicht tief validiert.
      return z.unknown();
  }
}

function hasDefault(field: Field): boolean {
  return options(field).default !== undefined;
}

export interface CollectionSchemas {
  insert: z.ZodObject;
  update: z.ZodObject;
  select: z.ZodObject;
}

/** Erzeugt insert/update/select Zod-Schemas für eine Collection. */
export function collectionSchemas(collection: CollectionConfig): CollectionSchemas {
  const insertShape: Record<string, z.ZodTypeAny> = {};
  const selectShape: Record<string, z.ZodTypeAny> = { id: z.string() };

  for (const [key, field] of Object.entries(collection.fields)) {
    const base = fieldSchema(field);
    const required = Boolean(options(field).required);
    // insert: required ohne Default muss angegeben werden, sonst optional.
    insertShape[key] = required && !hasDefault(field) ? base : base.optional();
    // select: vorhandene Werte; optional, wenn das Feld nicht required ist.
    selectShape[key] = required ? base : base.optional();
  }

  const insert = z.object(insertShape);
  return { insert, update: insert.partial(), select: z.object(selectShape) };
}
