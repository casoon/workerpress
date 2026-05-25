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

export interface CollectionConfig<Doc = unknown, User = unknown> {
  name: string;
  /** Schema-Version für Breaking-Change-Erkennung (siehe ARCHITECTURE §5). */
  version?: number;
  labels?: CollectionLabels;
  fields: Fields;
  access?: AccessRules<Doc, User>;
  hooks?: CollectionHooks;
  revalidate?: RevalidateTarget[];
}

export function defineCollection<Doc = unknown, User = unknown>(
  config: CollectionConfig<Doc, User>,
): CollectionConfig<Doc, User> {
  return config;
}
