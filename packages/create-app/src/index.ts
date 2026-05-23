#!/usr/bin/env node
/**
 * create-workerpress — interaktiver Scaffolder. Siehe STACK §4 (npx-Scaffolding).
 *
 * Geplanter Ablauf: Prompts (Projektname, Auth-Provider, optionale Module) →
 * Template kopieren → wrangler.toml/package.json schreiben → `cms setup` →
 * Migrationen → Seed. Das Islands-Framework ist fest Svelte (keine Abfrage).
 *
 * Grundgerüst: nimmt den Zielordner entgegen, die Generierung folgt.
 */

async function main(): Promise<void> {
  const target = process.argv[2] ?? 'my-workerpress';
  console.log(`[create-workerpress] Zielordner: ${target}`);
  console.log('[create-workerpress] Scaffolding ist im Skelett noch nicht implementiert.');
}

void main();
