/**
 * Plugin-System — Auto-Discovery aus `plugins/` und `@workerpress/plugin-*`.
 * Ein Plugin kann Collections, Routes, Admin-Erweiterungen, Hooks und Events
 * mitbringen. Siehe ARCHITECTURE §7 und §8.
 */

import type { CollectionConfig } from '../collections/index.js';
import type { CmsEventName, EventHandler } from '../events/index.js';

export interface AdminNavItem {
  label: string;
  path: string;
}

export interface AdminTableConfig {
  bulkActions?: unknown[];
  filters?: unknown[];
  views?: { name: string; where: Record<string, unknown> }[];
}

/** Admin-Erweiterungspunkte (Widgets, Field-Renderer, Bulk-Actions, Views, Filters). */
export interface AdminExtensions {
  nav?: AdminNavItem[];
  widgets?: unknown[];
  fieldRenderers?: Record<string, unknown>;
  tables?: Record<string, AdminTableConfig>;
}

export interface PluginConfig {
  name: string;
  version: string;
  collections?: CollectionConfig[];
  // biome-ignore lint/suspicious/noExplicitAny: Hono-App-Typ wird beim Mounten gesetzt
  routes?: (app: any) => unknown;
  admin?: AdminExtensions;
  hooks?: Record<string, (ctx: unknown) => void | Promise<void>>;
  on?: { [E in CmsEventName]?: EventHandler<E> };
  migrations?: string;
}

export function definePlugin(config: PluginConfig): PluginConfig {
  return config;
}
