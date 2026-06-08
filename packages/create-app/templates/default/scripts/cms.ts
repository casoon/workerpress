/**
 * Projekt-CLI: lädt die Collections und delegiert an @workerpress/core.
 * Befehle: inspect · routes · collections · migrations · doctor · generate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  describeCollectionsData,
  describeRoutesData,
  formatCollections,
  formatDoctor,
  formatRoutes,
  type InspectTarget,
  inspect,
  type MigrationSnapshot,
  renderOutput,
  runDoctor,
  type SchemaSnapshot,
} from '@workerpress/core';
import blog from '../collections/blog.js';

const collections = [blog];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const snap = (name: string): unknown =>
  existsSync(join(root, 'migrations', 'meta', name))
    ? JSON.parse(readFileSync(join(root, 'migrations', 'meta', name), 'utf8'))
    : undefined;
const previousSnapshot = snap('collections-snapshot.json') as MigrationSnapshot | undefined;
const previousSchemaSnapshot = snap('schema-snapshot.json') as SchemaSnapshot | undefined;

const args = process.argv.slice(2);
const [command] = args;
const json = args.includes('--json');
const out = (t: string) => process.stdout.write(`${t}\n`);

switch (command) {
  case 'routes':
    out(renderOutput(json, describeRoutesData(collections), formatRoutes(describeRoutesData(collections))));
    break;
  case 'collections':
    out(renderOutput(json, describeCollectionsData(collections), formatCollections(describeCollectionsData(collections))));
    break;
  case 'doctor': {
    const report = runDoctor({ collections, previousSchemaSnapshot, previousMigrationSnapshot: previousSnapshot, env: process.env });
    out(renderOutput(json, report, formatDoctor(report)));
    if (!report.ok) process.exit(1);
    break;
  }
  case 'inspect': {
    const collection = args.find((a) => !a.startsWith('-') && a !== 'inspect');
    out(inspect(collections, { collection, target: 'all' as InspectTarget, previousSnapshot, previousSchemaSnapshot }));
    break;
  }
  default:
    out('Usage: npm run cms <inspect|routes|collections|doctor> [--json]');
}
