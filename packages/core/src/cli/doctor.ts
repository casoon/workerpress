/**
 * `cms doctor` (M3-2) — maschinell auswertbarer Health-Check vor dem Deploy.
 * Deckt Migration-Drift, Schema-Breaks, fehlende Indizes, fehlende Bindings und
 * Secrets auf. Liefert einen strukturierten Report; das CLI setzt bei Fehlern
 * Exit-Code 1 (CI-Gate). Live-Checks (Bindings/echte Tabellen) sind optional —
 * fehlen sie, wird der Check als `skipped` markiert statt fälschlich grün.
 */

import type { CollectionConfig } from '../collections/index.js';
import { collectionSnapshot, diffCollections, type SchemaSnapshot } from '../db/diff.js';
import { generateMigration, type MigrationSnapshot } from '../db/migrate.js';
import { deriveTable } from '../db/table.js';

export type CheckStatus = 'ok' | 'warn' | 'error' | 'skipped';

export interface DoctorCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  /** false, sobald ein Check `error` ist → CLI-Exit-Code 1. */
  ok: boolean;
}

export interface DoctorInput {
  collections: CollectionConfig[];
  /** Vorheriger Schema-Snapshot (M1-13) für Breaking-Change-Erkennung. */
  previousSchemaSnapshot?: SchemaSnapshot;
  /** Vorheriger Migrations-Snapshot für Drift (Collections vs. generierte Migration). */
  previousMigrationSnapshot?: MigrationSnapshot;
  /** Env (Secrets-Prüfung). */
  env?: Record<string, string | undefined>;
  requiredSecrets?: string[];
  /** Erwartete Bindings (DB, MEDIA, CACHE). */
  requiredBindings?: string[];
  /** Tatsächlich vorhandene Bindings (Worker-Laufzeit). Fehlt → Check skipped. */
  bindings?: Record<string, unknown>;
  /** Tatsächlich angelegte Tabellen (Live-DB). Fehlt → Drift-Check nur statisch. */
  appliedTables?: string[];
}

export function runDoctor(input: DoctorInput): DoctorReport {
  const checks: DoctorCheck[] = [];

  // 1) Bindings vorhanden?
  const required = input.requiredBindings ?? ['DB', 'MEDIA', 'CACHE'];
  if (input.bindings) {
    const missing = required.filter((b) => !input.bindings?.[b]);
    checks.push({
      name: 'bindings',
      status: missing.length ? 'error' : 'ok',
      detail: missing.length ? `missing: ${missing.join(', ')}` : `present: ${required.join(', ')}`,
    });
  } else {
    checks.push({
      name: 'bindings',
      status: 'skipped',
      detail: 'no live env — run inside the worker or with wrangler to verify',
    });
  }

  // 2) Secrets vorhanden?
  const secrets = input.requiredSecrets ?? [];
  if (secrets.length) {
    const env = input.env ?? {};
    const missing = secrets.filter((s) => !env[s]);
    checks.push({
      name: 'secrets',
      status: missing.length ? 'error' : 'ok',
      detail: missing.length ? `missing: ${missing.join(', ')}` : `present: ${secrets.join(', ')}`,
    });
  }

  // 3) Migration-Drift: Collections geändert, aber keine Migration generiert?
  const { sql } = generateMigration(input.collections, input.previousMigrationSnapshot);
  checks.push({
    name: 'migration-drift',
    status: sql ? 'error' : 'ok',
    detail: sql
      ? 'collections changed but no migration generated — run db:generate:collections'
      : 'collections and generated migrations are in sync',
  });

  // 4) Schema-Breaking-Changes (Version N vs N-1).
  if (input.previousSchemaSnapshot) {
    const changes = diffCollections(
      input.previousSchemaSnapshot,
      collectionSnapshot(input.collections),
    );
    const breaking = changes.filter((c) => c.kind === 'breaking');
    checks.push({
      name: 'schema-breaking',
      status: breaking.length ? 'error' : 'ok',
      detail: breaking.length
        ? breaking.map((c) => c.description).join('; ')
        : 'no breaking schema changes',
    });
  } else {
    checks.push({
      name: 'schema-breaking',
      status: 'skipped',
      detail: 'no previous schema snapshot to compare against',
    });
  }

  // 5) Fehlende Tabellen/Indizes gegenüber der Live-DB (falls bekannt).
  const generatedTables = input.collections.map((c) => deriveTable(c).name);
  if (input.appliedTables) {
    const missing = generatedTables.filter((t) => !input.appliedTables?.includes(t));
    checks.push({
      name: 'tables',
      status: missing.length ? 'error' : 'ok',
      detail: missing.length
        ? `not applied: ${missing.join(', ')}`
        : `all ${generatedTables.length} collection tables present`,
    });
  } else {
    checks.push({
      name: 'tables',
      status: 'skipped',
      detail: 'no live DB — apply checks require wrangler d1',
    });
  }

  return { checks, ok: !checks.some((c) => c.status === 'error') };
}
