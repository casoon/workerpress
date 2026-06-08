/**
 * Cache-Revalidation (M2-8) — First-Class statt Stub. Bei jeder Schreiboperation
 * werden (a) die betroffenen öffentlichen Pfade aus `collection.revalidate`
 * invalidiert (KV + Edge-Cache) und (b) der Read-Through-Cache der betroffenen
 * Collection per Tag-Version entwertet. Cache-Keys sind site-aware (Host-Präfix),
 * damit Hauptseite und Landingpages nicht kollidieren (M2-9). Siehe ARCHITECTURE §11.
 */

import type { CollectionConfig, RevalidateTarget } from '../collections/index.js';
import type { Platform } from '../platform/index.js';

const PAGE_PREFIX = 'wp:page:';
const CONTENT_PREFIX = 'wp:cc:';
const TAG_PREFIX = 'wp:cv:';

/** Site-aware Schlüssel: `<host>:<path>` (Host fehlt → `*`, globaler Content). */
export function siteCacheKey(host: string | undefined, path: string): string {
  return `${host ?? '*'}:${path}`;
}

/** Löst `collection.revalidate` (string | ({doc})=>string) zu Pfaden auf. */
export function resolveRevalidateTargets(
  collection: CollectionConfig,
  doc: Record<string, unknown>,
): string[] {
  const targets: RevalidateTarget[] = collection.revalidate ?? [];
  const paths: string[] = [];
  for (const target of targets) {
    const path = typeof target === 'function' ? target({ doc }) : target;
    if (path) paths.push(path);
  }
  return paths;
}

/**
 * Invalidiert konkrete öffentliche Pfade: löscht den KV-Page-Cache-Key und —
 * sofern `origin` bekannt — den Edge-Cache-Eintrag der absoluten URL.
 */
export async function revalidatePaths(
  platform: Platform,
  paths: string[],
  opts: { host?: string; origin?: string } = {},
): Promise<void> {
  for (const path of paths) {
    await platform.kv.delete(`${PAGE_PREFIX}${siteCacheKey(opts.host, path)}`);
    if (opts.origin) await platform.cache.delete(`${opts.origin}${path}`);
  }
}

/** Aktuelle Tag-Version einer Collection (Default 0). */
async function tagVersion(
  platform: Platform,
  host: string | undefined,
  collection: string,
): Promise<number> {
  const raw = await platform.kv.get(`${TAG_PREFIX}${siteCacheKey(host, collection)}`);
  return raw ? Number(raw) || 0 : 0;
}

/**
 * Tag-Invalidierung: erhöht die Versionsnummer der Collection. Alle bisherigen
 * Read-Through-Keys (die die alte Version enthalten) sind damit unerreichbar und
 * laufen per TTL aus — keine teure Prefix-Löschung nötig.
 */
export async function revalidateTag(
  platform: Platform,
  collection: string,
  host?: string,
): Promise<void> {
  const next = (await tagVersion(platform, host, collection)) + 1;
  await platform.kv.put(`${TAG_PREFIX}${siteCacheKey(host, collection)}`, String(next));
}

/**
 * Read-Through für Content-GETs: liest aus KV (Hit), sonst lädt `load`, schreibt
 * mit TTL zurück. Der Key enthält die aktuelle Tag-Version — nach `revalidateTag`
 * greift automatisch ein Cache-Miss.
 */
export async function readThroughContent<T>(
  platform: Platform,
  opts: { host?: string; collection: string; suffix: string; ttl?: number },
  load: () => Promise<T>,
): Promise<T> {
  const version = await tagVersion(platform, opts.host, opts.collection);
  const key = `${CONTENT_PREFIX}${siteCacheKey(opts.host, `${opts.collection}:${version}:${opts.suffix}`)}`;
  const cached = await platform.kv.get(key);
  if (cached !== null) return JSON.parse(cached) as T;
  const value = await load();
  await platform.kv.put(key, JSON.stringify(value), opts.ttl ? { ttl: opts.ttl } : undefined);
  return value;
}

/**
 * Nach einer Schreiboperation: explizite Pfade invalidieren (KV + Edge) und den
 * Read-Through-Cache der Collection per Tag-Version entwerten.
 */
export async function revalidateOnWrite(
  platform: Platform,
  collection: CollectionConfig,
  doc: Record<string, unknown>,
  opts: { host?: string; origin?: string } = {},
): Promise<void> {
  await revalidatePaths(platform, resolveRevalidateTargets(collection, doc), opts);
  await revalidateTag(platform, collection.name, opts.host);
}
