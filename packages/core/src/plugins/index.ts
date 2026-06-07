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

/** Dashboard-Widget (M3-4): erscheint im Widget-Grid. `island`/`component` werden
 * im Admin-Layer importiert (nicht serialisiert). */
export interface AdminWidget {
  id: string;
  title: string;
  /** Import-Pfad der Svelte-Insel (vom Admin geladen). */
  island?: string;
  // biome-ignore lint/suspicious/noExplicitAny: opake Svelte-Komponente
  component?: any;
}

/** Bulk-Action (M3-4): erscheint in der Tabellen-Toolbar bei Selektion.
 * Deklarativ (`set`) → das Admin führt pro selektierter Zeile ein Update aus. */
export interface AdminBulkAction {
  id: string;
  label: string;
  /** Collection, für die die Aktion gilt; fehlt → alle. */
  collection?: string;
  /** Zu setzende Felder, z. B. `{ status: 'published' }`. */
  set?: Record<string, unknown>;
}

/** Gespeicherte Tabellen-Ansicht/Filter-Preset (M3-4). `where` ist Query-Layer-kompatibel. */
export interface SavedView {
  name: string;
  where: Record<string, unknown>;
  /** Collection, für die die View gilt; fehlt → alle. */
  collection?: string;
}

/** Custom Field-Renderer (M3-4): überschreibt die Default-Komponente eines Field-Typs. */
export interface AdminFieldRenderer {
  fieldType: string;
  island?: string;
  // biome-ignore lint/suspicious/noExplicitAny: opake Svelte-Komponente
  component?: any;
}

/** Admin-Erweiterungspunkte (Nav, Widgets, Field-Renderer, Bulk-Actions, Views). */
export interface AdminExtensions {
  nav?: AdminNavItem[];
  widgets?: AdminWidget[];
  fieldRenderers?: AdminFieldRenderer[];
  bulkActions?: AdminBulkAction[];
  views?: SavedView[];
}

/** Zusammengeführte Admin-Beiträge aller Plugins (für Astro/Svelte-Admin abfragbar). */
export interface ResolvedAdminExtensions {
  nav: AdminNavItem[];
  widgets: AdminWidget[];
  fieldRenderers: AdminFieldRenderer[];
  bulkActions: AdminBulkAction[];
  views: SavedView[];
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
  /** Zusammengeführte Admin-Erweiterungen (Widgets, Renderer, Bulk-Actions, Views). */
  adminExtensions: ResolvedAdminExtensions;
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
    adminExtensions: resolveAdminExtensions(ordered),
  };
}

/**
 * Führt die Admin-Erweiterungspunkte aller Plugins zusammen (M3-4). Reihenfolge =
 * Plugin-Reihenfolge; das Admin-Layer (Astro/Svelte) fragt das Ergebnis ab, um
 * Widgets, Field-Renderer, Bulk-Actions und Views einzuhängen.
 */
export function resolveAdminExtensions(plugins: PluginConfig[]): ResolvedAdminExtensions {
  return {
    nav: plugins.flatMap((p) => p.admin?.nav ?? []),
    widgets: plugins.flatMap((p) => p.admin?.widgets ?? []),
    fieldRenderers: plugins.flatMap((p) => p.admin?.fieldRenderers ?? []),
    bulkActions: plugins.flatMap((p) => p.admin?.bulkActions ?? []),
    views: plugins.flatMap((p) => p.admin?.views ?? []),
  };
}

/** Bulk-Actions + Views, die für eine bestimmte Collection gelten (inkl. globaler). */
export function adminExtensionsForCollection(
  ext: ResolvedAdminExtensions,
  collection: string,
): { bulkActions: AdminBulkAction[]; views: SavedView[] } {
  return {
    bulkActions: ext.bulkActions.filter((a) => !a.collection || a.collection === collection),
    views: ext.views.filter((v) => !v.collection || v.collection === collection),
  };
}

/** Menschenlesbare Übersicht der Admin-Erweiterungen (für `cms plugins`). */
export function describeAdminExtensions(plugins: PluginConfig[]): string {
  const ext = resolveAdminExtensions(plugins);
  return [
    '## Admin extensions',
    `  widgets: ${ext.widgets.length ? ext.widgets.map((w) => w.id).join(', ') : 'none'}`,
    `  fieldRenderers: ${ext.fieldRenderers.length ? ext.fieldRenderers.map((r) => r.fieldType).join(', ') : 'none'}`,
    `  bulkActions: ${ext.bulkActions.length ? ext.bulkActions.map((a) => a.id).join(', ') : 'none'}`,
    `  views: ${ext.views.length ? ext.views.map((v) => v.name).join(', ') : 'none'}`,
  ].join('\n');
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
