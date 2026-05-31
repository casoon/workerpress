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

/**
 * Kontext eines synchronen Lifecycle-Hooks (M2-2). Läuft im Request-Pfad und
 * kann die Operation blockieren. `doc` wird in-place verändert (z. B. um einen
 * Slug abzuleiten); ein `throw` bricht die Operation ab (REST: 422).
 */
export interface HookContext<Doc = Record<string, unknown>, User = unknown> {
  doc: Doc;
  user?: User;
  collection: string;
  operation: 'create' | 'update';
}

export type HookFn<Doc = Record<string, unknown>, User = unknown> = (
  ctx: HookContext<Doc, User>,
) => void | Promise<void>;

/** Hook mit expliziter Priorität (Standard 0, niedriger = früher). */
export interface PrioritizedHook<Doc = Record<string, unknown>, User = unknown> {
  handler: HookFn<Doc, User>;
  priority?: number;
}

/** Ein Hook als reine Funktion (priority 0) oder mit expliziter Priorität. */
export type HookEntry<Doc = Record<string, unknown>, User = unknown> =
  | HookFn<Doc, User>
  | PrioritizedHook<Doc, User>;

export interface CollectionHooks {
  /** Vor dem Schreiben (Create/Update). Darf `doc` verändern und abbrechen. */
  beforeChange?: HookEntry[];
  /** Nach erfolgreichem Schreiben. Soll nicht werfen — fehleranfällige
   * Nacharbeit gehört in den Event-Bus (M2-3). */
  afterChange?: HookEntry[];
}

export type RevalidateTarget = string | ((ctx: { doc: Record<string, unknown> }) => string);

export interface CollectionConfig<F extends Fields = Fields> {
  name: string;
  /** Schema-Version für Breaking-Change-Erkennung (siehe ARCHITECTURE §5). */
  version?: number;
  labels?: CollectionLabels;
  fields: F;
  access?: AccessRules;
  hooks?: CollectionHooks;
  revalidate?: RevalidateTarget[];
}

// `const F` bewahrt die Feld-Typen (für Row-/Insert-Inferenz, M1-6).
export function defineCollection<const F extends Fields>(
  config: CollectionConfig<F>,
): CollectionConfig<F> {
  return config;
}
