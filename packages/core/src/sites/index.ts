/**
 * Multi-Site (M2-9) — eine Installation verwaltet eine Hauptseite + N
 * Landingpages als *ein* Konstrukt (nicht Multi-Tenant). Content ist optional
 * einer Site zugeordnet; nicht zugeordneter Content (site = NULL) ist global und
 * erscheint auf allen Sites. Das Sites-Register ist Konfiguration (statisch
 * inspizierbar) und wird in die `sites`-Tabelle gespiegelt. Siehe ARCHITECTURE §13.
 */

import { sql } from 'drizzle-orm';
import type { DrizzleDatabase } from '../platform/index.js';

export type SiteRole = 'main' | 'landing';

export interface SiteConfig {
  id: string;
  role: SiteRole;
  /** Domain ohne Protokoll, z. B. `landing.example.com`. */
  host: string;
  /** Optionaler Pfad-Präfix, falls mehrere Sites eine Domain teilen. */
  pathPrefix?: string;
  name: string;
}

export function defineSite(site: SiteConfig): SiteConfig {
  return site;
}

/** DDL der `sites`-Tabelle (Teil der Plattform-Migration). */
export function sitesTableSql(): string {
  return [
    'CREATE TABLE IF NOT EXISTS "sites" (',
    '  "id" text PRIMARY KEY NOT NULL,',
    '  "role" text NOT NULL,',
    '  "host" text NOT NULL,',
    '  "path_prefix" text,',
    '  "name" text NOT NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS "sites_host_idx" ON "sites" ("host");',
  ].join('\n');
}

/** Normalisiert einen Host (ohne Port, lowercase). */
function normalizeHost(host: string): string {
  return host.toLowerCase().split(':')[0] ?? host.toLowerCase();
}

/**
 * Löst die aktive Site aus dem Host (bzw. `x-site`-Override) auf. Bei mehreren
 * Sites pro Host entscheidet der längste passende `pathPrefix`. Kein Treffer →
 * null (nur globaler Content).
 */
export function resolveSite(
  sites: SiteConfig[],
  host: string | undefined,
  path = '/',
): SiteConfig | null {
  if (!host) return null;
  const normalized = normalizeHost(host);
  // Direkter Treffer per id (x-site-Override gibt oft die id an).
  const byId = sites.find((s) => s.id === host);
  if (byId) return byId;
  const candidates = sites
    .filter((s) => normalizeHost(s.host) === normalized)
    .filter((s) => !s.pathPrefix || path.startsWith(s.pathPrefix))
    .sort((a, b) => (b.pathPrefix?.length ?? 0) - (a.pathPrefix?.length ?? 0));
  return candidates[0] ?? null;
}

/** Spiegelt das Sites-Register in die DB-Tabelle (idempotenter Upsert). */
export async function seedSites(db: DrizzleDatabase, sites: SiteConfig[]): Promise<void> {
  for (const site of sites) {
    await db.run(
      sql`INSERT INTO "sites" ("id", "role", "host", "path_prefix", "name") VALUES (${site.id}, ${site.role}, ${site.host}, ${site.pathPrefix ?? null}, ${site.name}) ON CONFLICT("id") DO UPDATE SET "role" = excluded."role", "host" = excluded."host", "path_prefix" = excluded."path_prefix", "name" = excluded."name"`,
    );
  }
}

/** Liest die Sites aus der DB (für Admin-Übersicht). */
export async function listSites(db: DrizzleDatabase): Promise<SiteConfig[]> {
  const rows = (await db.all(
    sql`SELECT "id", "role", "host", "path_prefix", "name" FROM "sites" ORDER BY "role" DESC, "name" ASC`,
  )) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    role: String(row.role) as SiteRole,
    host: String(row.host),
    pathPrefix: row.path_prefix == null ? undefined : String(row.path_prefix),
    name: String(row.name),
  }));
}

/** Menschenlesbare Übersicht des Sites-Registers (für `cms inspect`/`cms sites`). */
export function describeSites(sites: SiteConfig[]): string {
  if (sites.length === 0) return '## Sites (0)\n  none';
  const lines = [`## Sites (${sites.length})`];
  for (const site of sites) {
    const prefix = site.pathPrefix ? ` path=${site.pathPrefix}` : '';
    lines.push(`  - [${site.role}] ${site.name} — ${site.host}${prefix} (id=${site.id})`);
  }
  return lines.join('\n');
}
