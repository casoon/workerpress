/**
 * Collection-DSL — die eine Quelle der Wahrheit. Eine Definition generiert
 * Drizzle-Tabelle, Zod-Schemas, REST/RPC, OpenAPI, Admin-Formular, Query-Layer,
 * Such-Index und TypeScript-Typen. Siehe ARCHITECTURE §5.
 */

import type { Fields } from '../fields/index.js';
import type { AccessRules } from '../policies/index.js';

export interface CollectionLabels {
  singular: string;
  plural: string;
}

export type HookFn = (ctx: { doc: Record<string, unknown> }) => void | Promise<void>;

export interface CollectionHooks {
  beforeChange?: HookFn[];
  afterChange?: HookFn[];
}

export type RevalidateTarget = string | ((ctx: { doc: Record<string, unknown> }) => string);

export interface CollectionConfig {
  name: string;
  /** Schema-Version für Breaking-Change-Erkennung (siehe ARCHITECTURE §5). */
  version?: number;
  labels?: CollectionLabels;
  fields: Fields;
  access?: AccessRules;
  hooks?: CollectionHooks;
  revalidate?: RevalidateTarget[];
}

export function defineCollection(config: CollectionConfig): CollectionConfig {
  return config;
}
