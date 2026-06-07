/**
 * `cms setup` (M3-3): provisioniert D1/KV/R2 via Wrangler und trägt die IDs in
 * wrangler.toml ein. Idempotent — vorhandene Ressourcen werden übersprungen.
 *
 * Voraussetzung: `wrangler login` und ein Cloudflare-Account.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = join(root, 'wrangler.toml');
let toml = readFileSync(tomlPath, 'utf8');

function sh(cmd: string): string {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { encoding: 'utf8' });
}

function name(): string {
  return /name = "(.+?)"/.exec(toml)?.[1] ?? 'workerpress';
}

// D1
try {
  const out = sh(`wrangler d1 create ${name()}-db`);
  const id = /database_id = "(.+?)"/.exec(out)?.[1];
  if (id) toml = toml.replace(/database_id = ".*?"/, `database_id = "${id}"`);
} catch {
  console.log('D1 vorhanden oder Fehler — überspringe.');
}

// KV
try {
  const out = sh(`wrangler kv namespace create CACHE`);
  const id = /id = "(.+?)"/.exec(out)?.[1];
  if (id) toml = toml.replace(/binding = "CACHE"\nid = ".*?"/, `binding = "CACHE"\nid = "${id}"`);
} catch {
  console.log('KV vorhanden oder Fehler — überspringe.');
}

// R2 (falls Media-Modul aktiv)
if (toml.includes('binding = "MEDIA"')) {
  try {
    sh(`wrangler r2 bucket create ${name()}-media`);
  } catch {
    console.log('R2 vorhanden oder Fehler — überspringe.');
  }
}

writeFileSync(tomlPath, toml);
console.log('\n✓ wrangler.toml aktualisiert. Jetzt: npm run db:migrate && npm run seed');
