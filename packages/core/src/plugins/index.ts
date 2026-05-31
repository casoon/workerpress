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
  /** Namen anderer Plugins, die vorher aufgelöst sein müssen (Reihenfolge). */
  dependsOn?: string[];
}

export function definePlugin(config: PluginConfig): PluginConfig {
  return config;
}

/**
 * Aufgelöste Plugin-Registry: Plugins in Abhängigkeitsreihenfolge plus die
 * zusammengeführten Beiträge (Collections, Admin-Nav). Eine Quelle der Wahrheit
 * für Worker-Mounting, Migrations-Generierung und `cms`-Befehle.
 */
export interface ResolvedPlugins {
  /** Plugins in Abhängigkeitsreihenfolge (Dependencies zuerst). */
  plugins: PluginConfig[];
  /** Alle Collections aller Plugins, in Plugin-Reihenfolge. */
  collections: CollectionConfig[];
  /** Zusammengeführte Admin-Navigation. */
  adminNav: AdminNavItem[];
}

/**
 * Löst Plugins in eine deterministische Lade-Reihenfolge auf (topologische
 * Sortierung über `dependsOn`) und führt ihre Beiträge zusammen.
 *
 * Hinweis (Portabilität): das *Auffinden* der Plugins (Verzeichnis-Scan,
 * `@workerpress/plugin-*`) passiert außerhalb der Worker-Laufzeit (kein FS im
 * Worker) — die Registry wird als Array übergeben (siehe Starter `plugins/`).
 * Dieser Resolver ist die laufzeitsichere Hälfte und wirft bei Zyklen,
 * Namensdoubletten oder fehlenden Abhängigkeiten.
 */
export function resolvePlugins(plugins: PluginConfig[]): ResolvedPlugins {
  const byName = new Map<string, PluginConfig>();
  for (const plugin of plugins) {
    if (byName.has(plugin.name)) throw new Error(`Duplicate plugin name: ${plugin.name}`);
    byName.set(plugin.name, plugin);
  }

  const ordered: PluginConfig[] = [];
  const state = new Map<string, 'visiting' | 'done'>();

  function visit(plugin: PluginConfig, chain: string[]): void {
    const current = state.get(plugin.name);
    if (current === 'done') return;
    if (current === 'visiting') {
      throw new Error(`Plugin dependency cycle: ${[...chain, plugin.name].join(' -> ')}`);
    }
    state.set(plugin.name, 'visiting');
    for (const dep of plugin.dependsOn ?? []) {
      const target = byName.get(dep);
      if (!target) {
        throw new Error(`Plugin '${plugin.name}' depends on unknown plugin '${dep}'`);
      }
      visit(target, [...chain, plugin.name]);
    }
    state.set(plugin.name, 'done');
    ordered.push(plugin);
  }

  for (const plugin of plugins) visit(plugin, []);

  return {
    plugins: ordered,
    collections: ordered.flatMap((p) => p.collections ?? []),
    adminNav: ordered.flatMap((p) => p.admin?.nav ?? []),
  };
}

/** Menschenlesbare Übersicht entdeckter Plugins (für `cms plugins`). */
export function describePlugins(plugins: PluginConfig[]): string {
  const { plugins: ordered } = resolvePlugins(plugins);
  if (ordered.length === 0) return '## Plugins (0)\n  none';
  const lines = [`## Plugins (${ordered.length})`];
  for (const plugin of ordered) {
    const collections = (plugin.collections ?? []).map((c) => c.name);
    const hooks = plugin.hooks ? Object.keys(plugin.hooks) : [];
    const events = plugin.on ? Object.keys(plugin.on) : [];
    lines.push(
      `  - ${plugin.name}@${plugin.version}`,
      `      collections: ${collections.length ? collections.join(', ') : '-'}`,
      `      routes: ${plugin.routes ? 'yes' : '-'}`,
      `      hooks: ${hooks.length ? hooks.join(', ') : '-'}`,
      `      events: ${events.length ? events.join(', ') : '-'}`,
      `      dependsOn: ${plugin.dependsOn?.length ? plugin.dependsOn.join(', ') : '-'}`,
    );
  }
  return lines.join('\n');
}
