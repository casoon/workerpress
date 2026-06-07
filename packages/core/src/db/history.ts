/**
 * Content-Versionierung + Audit-Log (M2-6). Zwei feste Plattform-Tabellen (nicht
 * Collection-generiert): `content_versions` hält je Schreiboperation einen JSON-
 * Snapshot, `audit_log` protokolliert Aktionen inkl. abgelehnter Zugriffe (403).
 * Dient Compliance, Debugging und Wiederherstellung. Siehe ARCHITECTURE §4.
 */

import { sql } from 'drizzle-orm';
import { apiTokensTableSql } from '../auth/tokens.js';
import type { DrizzleDatabase } from '../platform/index.js';

export type AuditAction = 'create' | 'update' | 'delete' | 'access-denied';

export interface VersionRecord {
  id: string;
  collection: string;
  recordId: string;
  version: number;
  data: Record<string, unknown>;
  changedBy: string | null;
  changedAt: number;
}

export interface AuditEntry {
  action: AuditAction;
  collection: string;
  recordId?: string | null;
  user?: string | null;
  policy?: string | null;
  meta?: Record<string, unknown>;
}

/** DDL der festen Plattform-Tabellen (für Migration, Scaffolder, `cms doctor`). */
export function platformTablesSql(): string {
  return [
    'CREATE TABLE IF NOT EXISTS "content_versions" (',
    '  "id" text PRIMARY KEY NOT NULL,',
    '  "collection" text NOT NULL,',
    '  "record_id" text NOT NULL,',
    '  "version" integer NOT NULL,',
    '  "data" text NOT NULL,',
    '  "changed_by" text,',
    '  "changed_at" integer NOT NULL',
    ');',
    'CREATE INDEX IF NOT EXISTS "content_versions_record_idx" ON "content_versions" ("collection", "record_id");',
    'CREATE TABLE IF NOT EXISTS "audit_log" (',
    '  "id" text PRIMARY KEY NOT NULL,',
    '  "action" text NOT NULL,',
    '  "collection" text NOT NULL,',
    '  "record_id" text,',
    '  "user" text,',
    '  "policy" text,',
    '  "timestamp" integer NOT NULL,',
    '  "meta" text',
    ');',
    'CREATE INDEX IF NOT EXISTS "audit_log_collection_idx" ON "audit_log" ("collection", "record_id");',
    // API-Tokens (M2-7) gehören ebenfalls zu den festen Plattform-Tabellen.
    apiTokensTableSql(),
  ].join('\n');
}

const now = (): number => Math.floor(Date.now() / 1000);

/** Legt nach erfolgreichem Commit eine neue Version an (auto-inkrementiert). */
export async function recordVersion(
  db: DrizzleDatabase,
  input: {
    collection: string;
    recordId: string;
    data: Record<string, unknown>;
    changedBy?: string | null;
  },
): Promise<VersionRecord> {
  const rows = (await db.all(
    sql`SELECT MAX("version") AS max FROM "content_versions" WHERE "collection" = ${input.collection} AND "record_id" = ${input.recordId}`,
  )) as { max: number | null }[];
  const version = (rows[0]?.max ?? 0) + 1;
  const record: VersionRecord = {
    id: crypto.randomUUID(),
    collection: input.collection,
    recordId: input.recordId,
    version,
    data: input.data,
    changedBy: input.changedBy ?? null,
    changedAt: now(),
  };
  await db.run(
    sql`INSERT INTO "content_versions" ("id", "collection", "record_id", "version", "data", "changed_by", "changed_at") VALUES (${record.id}, ${record.collection}, ${record.recordId}, ${record.version}, ${JSON.stringify(record.data)}, ${record.changedBy}, ${record.changedAt})`,
  );
  return record;
}

function toVersion(row: Record<string, unknown>): VersionRecord {
  return {
    id: String(row.id),
    collection: String(row.collection),
    recordId: String(row.record_id),
    version: Number(row.version),
    data: row.data ? (JSON.parse(String(row.data)) as Record<string, unknown>) : {},
    changedBy: row.changed_by == null ? null : String(row.changed_by),
    changedAt: Number(row.changed_at),
  };
}

/** Versionsliste eines Datensatzes, neueste zuerst. */
export async function listVersions(
  db: DrizzleDatabase,
  collection: string,
  recordId: string,
): Promise<VersionRecord[]> {
  const rows = (await db.all(
    sql`SELECT * FROM "content_versions" WHERE "collection" = ${collection} AND "record_id" = ${recordId} ORDER BY "version" DESC`,
  )) as Record<string, unknown>[];
  return rows.map(toVersion);
}

/** Einzelner Versions-Snapshot (oder null). */
export async function getVersion(
  db: DrizzleDatabase,
  collection: string,
  recordId: string,
  version: number,
): Promise<VersionRecord | null> {
  const rows = (await db.all(
    sql`SELECT * FROM "content_versions" WHERE "collection" = ${collection} AND "record_id" = ${recordId} AND "version" = ${version} LIMIT 1`,
  )) as Record<string, unknown>[];
  return rows[0] ? toVersion(rows[0]) : null;
}

/** Schreibt einen Audit-Log-Eintrag (inkl. `access-denied` bei 403). */
export async function recordAudit(db: DrizzleDatabase, entry: AuditEntry): Promise<void> {
  await db.run(
    sql`INSERT INTO "audit_log" ("id", "action", "collection", "record_id", "user", "policy", "timestamp", "meta") VALUES (${crypto.randomUUID()}, ${entry.action}, ${entry.collection}, ${entry.recordId ?? null}, ${entry.user ?? null}, ${entry.policy ?? null}, ${now()}, ${entry.meta ? JSON.stringify(entry.meta) : null})`,
  );
}

/** Liest Audit-Einträge einer Collection (neueste zuerst) — für Admin/Debug. */
export async function listAudit(
  db: DrizzleDatabase,
  collection: string,
  limit = 100,
): Promise<Record<string, unknown>[]> {
  const rows = (await db.all(
    sql`SELECT * FROM "audit_log" WHERE "collection" = ${collection} ORDER BY "timestamp" DESC LIMIT ${Math.min(Math.max(limit, 1), 500)}`,
  )) as Record<string, unknown>[];
  return rows.map((r) => ({ ...r, meta: r.meta ? JSON.parse(String(r.meta)) : null }));
}
