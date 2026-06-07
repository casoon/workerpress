#!/usr/bin/env node
/**
 * create-workerpress — interaktiver Scaffolder (M3-3, STACK §4).
 *
 * Ablauf: Prompts (Projektname, Auth-Provider, optionale Module) → Template
 * kopieren → wrangler.toml/package.json/auth.ts schreiben → Hinweise für
 * `cms setup`, Migrationen und Seed. Das Islands-Framework ist fest Svelte.
 *
 * Nicht-interaktiv: `create-workerpress <name> --yes` nimmt die Defaults.
 */

import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, select, text } from './prompts.js';
import {
  type AuthProvider,
  applyVars,
  nextSteps,
  renderAuth,
  renderWranglerToml,
  type ScaffoldAnswers,
  validateProjectName,
} from './scaffold.js';

const here = dirname(fileURLToPath(import.meta.url));
// templates/ liegt neben dist/ (siehe package.json `files`).
const templateDir = join(here, '..', 'templates', 'default');

async function gatherAnswers(argName: string | undefined, yes: boolean): Promise<ScaffoldAnswers> {
  const projectName = yes
    ? (argName ?? 'my-workerpress')
    : await text('Projektname', argName ?? 'my-workerpress');
  const error = validateProjectName(projectName);
  if (error) {
    console.error(`✗ ${error}`);
    process.exit(1);
  }
  if (yes) return { projectName, auth: 'access', media: true, aiSearch: false };

  const auth = await select<AuthProvider>(
    'Auth-Provider?',
    [
      { value: 'access', label: 'Cloudflare Access (Zero Trust)' },
      { value: 'better-auth', label: 'Better Auth (Sessions)' },
    ],
    'access',
  );
  const media = await confirm('Modul: Media (R2-Uploads)?', true);
  const aiSearch = await confirm('Modul: Workers-AI-Suche?', false);
  return { projectName, auth, media, aiSearch };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes') || args.includes('-y');
  const argName = args.find((a) => !a.startsWith('-'));
  const answers = await gatherAnswers(argName, yes);

  const target = join(process.cwd(), answers.projectName);
  if (existsSync(target)) {
    console.error(`✗ Ordner ${answers.projectName} existiert bereits.`);
    process.exit(1);
  }

  // 1) Template kopieren.
  await mkdir(target, { recursive: true });
  await cp(templateDir, target, { recursive: true });

  // 2) Platzhalter in package.json ersetzen.
  const pkgPath = join(target, 'package.json');
  await writeFile(
    pkgPath,
    applyVars(await readFile(pkgPath, 'utf8'), { PROJECT_NAME: answers.projectName }),
  );

  // 3) wrangler.toml + auth.ts aus den Antworten generieren.
  await writeFile(join(target, 'wrangler.toml'), renderWranglerToml(answers));
  await writeFile(join(target, 'src', 'server', 'auth.ts'), renderAuth(answers.auth));

  // 4) Hinweise.
  console.log(
    `\n✓ ${answers.projectName} erstellt (auth=${answers.auth}, media=${answers.media}, aiSearch=${answers.aiSearch}).\n`,
  );
  console.log('Nächste Schritte:');
  for (const step of nextSteps(answers)) console.log(`  ${step}`);
}

void main();
