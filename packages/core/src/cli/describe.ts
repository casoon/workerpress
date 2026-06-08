/**
 * Strukturierte Beschreibungen der generierten Realität (M3-1) — die Datenquelle
 * hinter den `cms`-Befehlen `routes`, `collections`, `plugins`. Gibt reine Daten
 * zurück (für `--json`); die Text-/Farbausgabe übernimmt `cli/format.ts`. So sind
 * Mensch- und Maschinen-Ausgabe deckungsgleich. Siehe ARCHITECTURE §5.
 */

import type { CollectionConfig } from '../collections/index.js';
import { searchableFields } from '../db/fts5.js';
import type { PluginConfig } from '../plugins/index.js';

export interface RouteInfo {
  method: string;
  path: string;
  /** Auth-Anforderung: `public`, `policy:<name>`, `auth` (Session/Token) … */
  auth: string;
  surface: 'content' | 'internal' | 'plugin' | 'system';
}

/** Routen einer einzelnen Collection (Content read-only + Internal CRUD). */
export function collectionRoutes(
  collection: CollectionConfig,
  opts: { history?: boolean } = {},
): RouteInfo[] {
  const n = collection.name;
  const read = collection.access?.read ? `policy:${collection.access.read.name}` : 'public';
  const write = collection.access?.write ? `policy:${collection.access.write.name}` : 'auth';
  const routes: RouteInfo[] = [
    { method: 'GET', path: `/api/content/${n}`, auth: read, surface: 'content' },
    { method: 'GET', path: `/api/content/${n}/:id`, auth: read, surface: 'content' },
    { method: 'GET', path: `/api/internal/content/${n}`, auth: read, surface: 'internal' },
    { method: 'GET', path: `/api/internal/content/${n}/:id`, auth: read, surface: 'internal' },
    { method: 'POST', path: `/api/internal/content/${n}`, auth: write, surface: 'internal' },
    { method: 'PUT', path: `/api/internal/content/${n}/:id`, auth: write, surface: 'internal' },
    { method: 'DELETE', path: `/api/internal/content/${n}/:id`, auth: write, surface: 'internal' },
  ];
  if (searchableFields(collection).length > 0) {
    routes.push({
      method: 'GET',
      path: `/api/internal/content/${n}/search`,
      auth: read,
      surface: 'internal',
    });
  }
  if (opts.history) {
    routes.push(
      {
        method: 'GET',
        path: `/api/internal/content/${n}/:id/versions`,
        auth: read,
        surface: 'internal',
      },
      {
        method: 'GET',
        path: `/api/internal/content/${n}/:id/versions/:v`,
        auth: read,
        surface: 'internal',
      },
    );
  }
  return routes;
}

export interface DescribeRoutesOptions {
  history?: boolean;
  tokens?: boolean;
  /** Zusätzliche Plugin-/Custom-Routen, manuell ergänzt. */
  extra?: RouteInfo[];
}

/** Alle Routen über alle Collections + System/Plugin-Routen (für `cms routes`). */
export function describeRoutesData(
  collections: CollectionConfig[],
  plugins: PluginConfig[] = [],
  opts: DescribeRoutesOptions = {},
): RouteInfo[] {
  const routes: RouteInfo[] = [
    { method: 'GET', path: '/api/health', auth: 'public', surface: 'system' },
    { method: 'GET', path: '/api/docs', auth: 'public', surface: 'system' },
  ];
  if (opts.tokens) {
    routes.push(
      { method: 'POST', path: '/api/internal/tokens', auth: 'admin', surface: 'internal' },
      { method: 'GET', path: '/api/internal/tokens', auth: 'admin', surface: 'internal' },
      { method: 'DELETE', path: '/api/internal/tokens/:id', auth: 'admin', surface: 'internal' },
    );
  }
  for (const collection of collections) routes.push(...collectionRoutes(collection, opts));
  for (const plugin of plugins) {
    if (plugin.routes) {
      routes.push({
        method: '*',
        path: `/api/internal/plugins/${plugin.name}/*`,
        auth: 'auth',
        surface: 'plugin',
      });
    }
  }
  return [...(opts.extra ?? []), ...routes];
}

export interface CollectionInfo {
  name: string;
  version: number;
  fields: number;
  policies: { read: string | null; write: string | null };
  searchable: string[];
  hooks: { beforeChange: number; afterChange: number };
}

/** Registrierte Collections mit Version, Feld-Anzahl, Policy-Namen (für `cms collections`). */
export function describeCollectionsData(collections: CollectionConfig[]): CollectionInfo[] {
  return collections.map((c) => ({
    name: c.name,
    version: c.version ?? 1,
    fields: Object.keys(c.fields).length,
    policies: {
      read: c.access?.read?.name ?? null,
      write: c.access?.write?.name ?? null,
    },
    searchable: searchableFields(c),
    hooks: {
      beforeChange: c.hooks?.beforeChange?.length ?? 0,
      afterChange: c.hooks?.afterChange?.length ?? 0,
    },
  }));
}

/** Scaffoldet eine neue Collection-Datei mit sinnvollen Defaults (für `cms generate`). */
export function scaffoldCollection(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_]/g, '');
  return `import { defineCollection, field } from '@workerpress/core';

/**
 * Collection \`${safe}\` — generiert via \`cms generate collection ${safe}\`.
 * Eine Definition erzeugt Tabelle, Zod-Schemas, REST/RPC, OpenAPI, Admin-Form
 * und Such-Index. Felder anpassen, dann \`pnpm db:generate:collections\` ausführen.
 */
export default defineCollection({
  name: '${safe}',
  version: 1,
  labels: { singular: '${safe}', plural: '${safe}' },
  fields: {
    title: field.text({ required: true, max: 200 }),
    slug: field.slug({ from: 'title', unique: true, indexed: true }),
    body: field.richText({ searchable: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
  },
});
`;
}
