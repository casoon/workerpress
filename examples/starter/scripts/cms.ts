/**
 * Starter-CLI für den Collection-DSL (M3-1). Lädt Collections/Plugins/Sites (TS
 * via tsx) und delegiert an die programmatische API in `@workerpress/core`. Alle
 * Befehle unterstützen `--json` für maschinenlesbare Ausgabe.
 *
 * Befehle: inspect · routes · collections · migrations · plugins · sites · generate
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type CollectionConfig,
  collectionRoutes,
  collectionSchemas,
  collectionSnapshot,
  deriveTable,
  describeCollectionsData,
  describePlugins,
  describeRoutesData,
  describeSites,
  describeSubscribers,
  diffCollections,
  formatCollections,
  formatDoctor,
  formatRoutes,
  generateMigration,
  type InspectTarget,
  inspect,
  type MigrationSnapshot,
  renderOutput,
  resolvePlugins,
  runDoctor,
  type SchemaSnapshot,
  scaffoldCollection,
  searchableFields,
} from '@workerpress/core';
import blog from '../collections/blog.js';
import pages from '../collections/pages.js';
import { plugins } from '../plugins/index.js';
import { sites } from '../sites.js';

const resolved = resolvePlugins(plugins);
// First-Party + automatisch aufgelöste Plugin-Collections (M2-1).
const collections: CollectionConfig[] = [blog, pages, ...resolved.collections];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'migrations');
const snapshotPath = join(migrationsDir, 'meta', 'collections-snapshot.json');
const schemaSnapshotPath = join(migrationsDir, 'meta', 'schema-snapshot.json');
const previousSnapshot: MigrationSnapshot | undefined = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : undefined;
const previousSchemaSnapshot: SchemaSnapshot | undefined = existsSync(schemaSnapshotPath)
  ? JSON.parse(readFileSync(schemaSnapshotPath, 'utf8'))
  : undefined;

// Im Starter aktivierte Routen-Features (history + tokens), damit `cms routes`
// dieselben Pfade zeigt, die der Worker tatsächlich mountet (siehe server/app.ts).
const routeFeatures = { history: true, tokens: true };

const args = process.argv.slice(2);
const [command, ...rest] = args;
const json = rest.includes('--json') || args.includes('--json');
const positional = rest.filter((a) => !a.startsWith('--'));

function out(text: string): void {
  process.stdout.write(`${text}\n`);
}

function runInspect(): void {
  const flags = rest.filter((a) => a.startsWith('--') && a !== '--json');
  const map: Record<string, InspectTarget> = {
    '--routes': 'routes',
    '--schema': 'schema',
    '--migrations': 'migrations',
    '--hooks': 'hooks',
    '--policies': 'policies',
    '--forms': 'forms',
    '--search': 'search',
  };
  const target: InspectTarget = (flags.map((f) => map[f]).find(Boolean) as InspectTarget) ?? 'all';
  const collection = positional[0];

  if (json) {
    const chosen = collection ? collections.filter((c) => c.name === collection) : collections;
    const data = chosen.map((c) => ({
      name: c.name,
      version: c.version ?? 1,
      table: deriveTable(c),
      routes: collectionRoutes(c, routeFeatures),
      schemas: {
        insert: Object.keys((collectionSchemas(c).insert as { shape?: object }).shape ?? {}),
        update: Object.keys((collectionSchemas(c).update as { shape?: object }).shape ?? {}),
      },
      policies: { read: c.access?.read?.name ?? null, write: c.access?.write?.name ?? null },
      hooks: {
        beforeChange: c.hooks?.beforeChange?.length ?? 0,
        afterChange: c.hooks?.afterChange?.length ?? 0,
      },
      searchable: searchableFields(c),
    }));
    out(JSON.stringify(collection ? data[0] : data, null, 2));
    return;
  }
  out(inspect(collections, { collection, target, previousSnapshot, previousSchemaSnapshot }));

  // Dry-Run-Gate (M3-2): `cms inspect --migrations --gate` bricht bei Breaking-
  // Changes mit Exit-Code 1 ab — als CI-Schranke vor dem Deploy.
  if (rest.includes('--gate') && previousSchemaSnapshot) {
    const breaking = diffCollections(
      previousSchemaSnapshot,
      collectionSnapshot(collections),
    ).filter((c) => c.kind === 'breaking');
    if (breaking.length) {
      process.stderr.write(`\n[cms] ${breaking.length} breaking change(s) — failing gate.\n`);
      process.exit(1);
    }
  }
}

function runRoutes(): void {
  const routes = describeRoutesData(collections, resolved.plugins, routeFeatures);
  out(renderOutput(json, routes, formatRoutes(routes)));
}

function runCollections(): void {
  const data = describeCollectionsData(collections);
  out(renderOutput(json, data, formatCollections(data)));
}

function runMigrations(): void {
  const files = existsSync(migrationsDir)
    ? readdirSync(migrationsDir)
        .filter((f) => /^\d{4}_.*\.sql$/.test(f))
        .sort()
    : [];
  const { sql } = generateMigration(collections, previousSnapshot);
  const changes = previousSchemaSnapshot
    ? diffCollections(previousSchemaSnapshot, collectionSnapshot(collections))
    : [];
  const breaking = changes.filter((c) => c.kind === 'breaking');
  const data = {
    applied: files,
    pending: sql ? 'schema changes not yet generated — run db:generate:collections' : null,
    breaking: breaking.map((c) => c.description),
  };
  if (json) {
    out(JSON.stringify(data, null, 2));
    return;
  }
  out(`Applied migrations (${files.length}):`);
  for (const f of files) out(`  ${f}`);
  out(data.pending ? `\nPending: ${data.pending}` : '\nPending: none (schema in sync)');
  if (breaking.length) {
    out('\n⚠ Breaking changes:');
    for (const c of breaking) out(`  ${c.description}`);
  }
}

function runDoctorCmd(): void {
  // ACCESS_TEAM_DOMAIN ist im Starter das Pflicht-Secret für Cloudflare Access.
  const report = runDoctor({
    collections,
    previousSchemaSnapshot,
    previousMigrationSnapshot: previousSnapshot,
    env: process.env,
    requiredSecrets: ['ACCESS_TEAM_DOMAIN'],
  });
  out(renderOutput(json, report, formatDoctor(report)));
  if (!report.ok) process.exit(1);
}

function runGenerate(): void {
  const [kind, name] = positional;
  if (kind !== 'collection' || !name) {
    process.stderr.write('Usage: cms generate collection <name>\n');
    process.exit(1);
  }
  const target = join(root, 'collections', `${name}.ts`);
  if (existsSync(target)) {
    process.stderr.write(`[cms] ${name}.ts already exists — aborting.\n`);
    process.exit(1);
  }
  writeFileSync(target, scaffoldCollection(name));
  out(`Wrote collections/${name}.ts — add fields, then run pnpm db:generate:collections`);
}

function printHelp(): void {
  out(
    'WorkerPress Starter CMS\n\nUsage: pnpm cms <command> [--json]\n\nCommands:\n' +
      '  inspect [collection] [--routes|--schema|--migrations|--hooks|--policies|--forms|--search] [--gate]\n' +
      '  routes\n' +
      '  collections\n' +
      '  migrations\n' +
      '  doctor            (exit 1 on errors — CI gate)\n' +
      '  plugins\n' +
      '  sites\n' +
      '  generate collection <name>\n',
  );
}

switch (command) {
  case 'inspect':
    runInspect();
    break;
  case 'routes':
    runRoutes();
    break;
  case 'collections':
    runCollections();
    break;
  case 'migrations':
    runMigrations();
    break;
  case 'doctor':
    runDoctorCmd();
    break;
  case 'plugins':
    out(
      json
        ? JSON.stringify(resolved.plugins, null, 2)
        : `${describePlugins(plugins)}\n\n${describeSubscribers(plugins)}`,
    );
    break;
  case 'sites':
    out(json ? JSON.stringify(sites, null, 2) : describeSites(sites));
    break;
  case 'generate':
    runGenerate();
    break;
  case undefined:
  case 'help':
  case '--help':
  case '-h':
    printHelp();
    break;
  default:
    process.stderr.write(`[cms] Unknown command: ${command}\n`);
    printHelp();
    process.exit(1);
}
