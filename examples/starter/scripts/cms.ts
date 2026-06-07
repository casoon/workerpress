/**
 * Starter-CLI für den Collection-DSL. Lädt die Collections (TS via tsx) und
 * delegiert an die programmatische API in `@workerpress/core`. Vorläufer der
 * Discovery-fähigen `workerpress`-CLI.
 *
 * Nutzung: pnpm cms inspect [collection] [--routes|--schema|--migrations]
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describePlugins,
  describeSites,
  describeSubscribers,
  type InspectTarget,
  inspect,
  type MigrationSnapshot,
  resolvePlugins,
  type SchemaSnapshot,
} from '@workerpress/core';
import blog from '../collections/blog.js';
import pages from '../collections/pages.js';
import { plugins } from '../plugins/index.js';
import { sites } from '../sites.js';

// First-Party + automatisch aufgelöste Plugin-Collections (M2-1), damit z. B.
// `cms inspect comments` und die Tabellenliste die Plugin-Collection enthalten.
const collections = [blog, pages, ...resolvePlugins(plugins).collections];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = join(root, 'migrations', 'meta', 'collections-snapshot.json');
const schemaSnapshotPath = join(root, 'migrations', 'meta', 'schema-snapshot.json');
const previousSnapshot: MigrationSnapshot | undefined = existsSync(snapshotPath)
  ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
  : undefined;
const previousSchemaSnapshot: SchemaSnapshot | undefined = existsSync(schemaSnapshotPath)
  ? JSON.parse(readFileSync(schemaSnapshotPath, 'utf8'))
  : undefined;

const [command, ...rest] = process.argv.slice(2);

function runInspect(args: string[]): void {
  let target: InspectTarget = 'all';
  let collection: string | undefined;
  for (const arg of args) {
    if (arg === '--routes') target = 'routes';
    else if (arg === '--schema') target = 'schema';
    else if (arg === '--migrations') target = 'migrations';
    else if (arg === '--hooks') target = 'hooks';
    else if (!arg.startsWith('--')) collection = arg;
  }
  process.stdout.write(
    `${inspect(collections, { collection, target, previousSnapshot, previousSchemaSnapshot })}\n`,
  );
}

function printHelp(): void {
  process.stdout.write(
    'WorkerPress Starter CMS\n\nUsage: pnpm cms <command>\n\nCommands:\n' +
      '  inspect [collection] [--routes|--schema|--migrations|--hooks]\n' +
      '  plugins\n' +
      '  sites\n',
  );
}

switch (command) {
  case 'inspect':
    runInspect(rest);
    break;
  case 'plugins':
    process.stdout.write(`${describePlugins(plugins)}\n\n${describeSubscribers(plugins)}\n`);
    break;
  case 'sites':
    process.stdout.write(`${describeSites(sites)}\n`);
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
