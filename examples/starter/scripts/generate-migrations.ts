/**
 * Generiert aus den Collection-Definitionen (blog, pages) eine Drizzle/D1-Migration
 * über den Core-Generator. Idempotent: unveränderte Definitionen erzeugen nichts
 * (Snapshot-Vergleich). Vorläufer der `workerpress generate`-CLI (#20).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMigration, type MigrationSnapshot } from '@workerpress/core';
import blog from '../collections/blog.js';
import pages from '../collections/pages.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'migrations');
const snapshotPath = join(migrationsDir, 'meta', 'collections-snapshot.json');

const previous: MigrationSnapshot | undefined = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : undefined;

const { sql, snapshot } = generateMigration([blog, pages], previous);

if (!sql) {
  console.log('Collections unchanged — no migration generated.');
} else {
  const existing = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.*\.sql$/.test(file))
        .map((file) => Number(file.slice(0, 4)))
    : [];
  const next = String((existing.length > 0 ? Math.max(...existing) : -1) + 1).padStart(4, '0');

  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(join(migrationsDir, `${next}_collections.sql`), `${sql}\n`);
  writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(`Wrote ${next}_collections.sql`);
}
