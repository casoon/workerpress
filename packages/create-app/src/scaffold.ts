/**
 * Reine Scaffolding-Logik (M3-3) — Platzhalter-Ersetzung und Datei-Rendering,
 * getrennt von I/O und Prompts, damit testbar. Siehe STACK §4.
 */

export type AuthProvider = 'access' | 'better-auth';

export interface ScaffoldAnswers {
  projectName: string;
  auth: AuthProvider;
  /** Optionale Module: Media (R2) und Workers-AI-Suche. */
  media: boolean;
  aiSearch: boolean;
}

export interface TemplateVars {
  PROJECT_NAME: string;
}

/** Ersetzt `__VAR__`-Platzhalter im Inhalt. Unbekannte Platzhalter bleiben stehen. */
export function applyVars(content: string, vars: TemplateVars): string {
  return content.replace(/__([A-Z_]+)__/g, (match, key: string) =>
    key in vars ? String(vars[key as keyof TemplateVars]) : match,
  );
}

/** Validiert einen Projekt-/npm-Paketnamen. Gibt eine Fehlermeldung oder null zurück. */
export function validateProjectName(name: string): string | null {
  if (!name?.trim()) return 'Projektname darf nicht leer sein';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) {
    return 'Nur Kleinbuchstaben, Ziffern und . _ - erlaubt (npm-Paketname)';
  }
  return null;
}

/** Rendert die wrangler.toml — bedingte Bindings je nach gewählten Modulen. */
export function renderWranglerToml(answers: ScaffoldAnswers): string {
  const lines = [
    `name = "${answers.projectName}"`,
    'main = "dist/_worker.js/index.js"',
    'compatibility_date = "2025-01-01"',
    'compatibility_flags = ["nodejs_compat"]',
    '',
    '[[d1_databases]]',
    'binding = "DB"',
    `database_name = "${answers.projectName}-db"`,
    'database_id = "__SET_BY_CMS_SETUP__"',
    'migrations_dir = "migrations"',
    '',
    '[[kv_namespaces]]',
    'binding = "CACHE"',
    'id = "__SET_BY_CMS_SETUP__"',
  ];
  if (answers.media) {
    lines.push(
      '',
      '[[r2_buckets]]',
      'binding = "MEDIA"',
      `bucket_name = "${answers.projectName}-media"`,
    );
  }
  if (answers.aiSearch) {
    lines.push('', '[ai]', 'binding = "AI"');
  }
  return `${lines.join('\n')}\n`;
}

/** Rendert die auth.ts passend zum gewählten Provider. */
export function renderAuth(provider: AuthProvider): string {
  if (provider === 'better-auth') {
    return `/**
 * Auth über Better Auth (vom Scaffolder gewählt). Session-basiert; den
 * konkreten Adapter (D1) in einem Folge-Schritt verdrahten.
 */
import type { AuthUser, AuthVerifier } from '@workerpress/core';

const DEV_USER: AuthUser = { id: 'demo', email: 'demo@local', groups: ['admin'] };

export async function resolveUser(_request: Request): Promise<AuthUser | null> {
  // TODO: Better-Auth-Session prüfen; im Dev-Modus Demo-Session.
  return import.meta.env.DEV ? DEV_USER : null;
}
`;
  }
  return `/**
 * Auth über Cloudflare Access (vom Scaffolder gewählt). Verifiziert das
 * Access-JWT; im Dev-Modus eine Demo-Session.
 */
import { createCloudflareAccessAuth } from '@workerpress/cloudflare';
import type { AuthUser, AuthVerifier } from '@workerpress/core';

const ACCESS_TEAM_DOMAIN = 'CHANGE_ME';
const DEV_USER: AuthUser = { id: 'demo', email: 'demo@local', groups: ['admin'] };

let verifier: AuthVerifier | null = null;
function getVerifier(): AuthVerifier {
  if (!verifier) verifier = createCloudflareAccessAuth({ teamDomain: ACCESS_TEAM_DOMAIN });
  return verifier;
}

export async function resolveUser(request: Request): Promise<AuthUser | null> {
  const user = await getVerifier().verify(request);
  if (user) return user;
  return import.meta.env.DEV ? DEV_USER : null;
}

export { ACCESS_TEAM_DOMAIN };
`;
}

/** Die `next steps`-Hinweise nach dem Scaffolding. */
export function nextSteps(answers: ScaffoldAnswers): string[] {
  return [
    `cd ${answers.projectName}`,
    'npm install',
    `npm run cms setup    # provisioniert D1/KV${answers.media ? '/R2' : ''}`,
    'npm run db:migrate',
    'npm run seed         # Admin-User + Demo-Blog',
    'npm run dev',
  ];
}
