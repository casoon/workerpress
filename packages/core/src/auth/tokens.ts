/**
 * API-Tokens mit Scopes (M2-7) — programmatischer Zugriff ohne Browser-Session.
 * Tokens werden nur als SHA-256-Hash gespeichert; der Klartext erscheint genau
 * einmal bei der Ausstellung. Scopes steuern granular den Zugriff. Siehe
 * ARCHITECTURE §6/§10.
 */

import { sql } from 'drizzle-orm';
import type { AuthUser, DrizzleDatabase } from '../platform/index.js';

/** Bekannte Scopes. `admin` schließt alle anderen ein. */
export type Scope = 'content:read' | 'content:write' | 'media:write' | 'admin';

export interface TokenPrincipal {
  id: string;
  name: string;
  scopes: string[];
  createdBy: string | null;
}

export interface IssuedToken {
  id: string;
  /** Klartext — nur hier verfügbar, danach nie wieder. */
  token: string;
}

/** DDL der api_tokens-Tabelle (Teil der Plattform-Migration). */
export function apiTokensTableSql(): string {
  return [
    'CREATE TABLE IF NOT EXISTS "api_tokens" (',
    '  "id" text PRIMARY KEY NOT NULL,',
    '  "name" text NOT NULL,',
    '  "token_hash" text NOT NULL,',
    '  "scopes" text NOT NULL,',
    '  "created_by" text,',
    '  "expires_at" integer,',
    '  "last_used_at" integer',
    ');',
    'CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_hash_idx" ON "api_tokens" ("token_hash");',
  ].join('\n');
}

const now = (): number => Math.floor(Date.now() / 1000);

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256-Hash (Web Crypto, verfügbar in Workers und Node ≥ 22). */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return hex(new Uint8Array(digest));
}

function generateToken(): string {
  return `wp_${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

/**
 * Stellt ein Token aus. `revoke` widerruft beim Rotieren das alte Token in einem
 * Schritt. Gibt `{ id, token }` zurück — der Klartext ist danach nicht mehr lesbar.
 */
export async function createApiToken(
  db: DrizzleDatabase,
  input: {
    name: string;
    scopes: string[];
    createdBy?: string | null;
    expiresAt?: number | null;
    revoke?: string;
  },
): Promise<IssuedToken> {
  if (input.revoke) await revokeApiToken(db, input.revoke);
  const id = crypto.randomUUID();
  const token = generateToken();
  const tokenHash = await hashToken(token);
  await db.run(
    sql`INSERT INTO "api_tokens" ("id", "name", "token_hash", "scopes", "created_by", "expires_at", "last_used_at") VALUES (${id}, ${input.name}, ${tokenHash}, ${JSON.stringify(input.scopes)}, ${input.createdBy ?? null}, ${input.expiresAt ?? null}, ${null})`,
  );
  return { id, token };
}

/**
 * Verifiziert ein Bearer-Token. Prüft Existenz + Ablauf, aktualisiert
 * `last_used_at` und liefert den Principal (mit Scopes) — oder null.
 */
export async function verifyApiToken(
  db: DrizzleDatabase,
  token: string,
): Promise<TokenPrincipal | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const rows = (await db.all(
    sql`SELECT * FROM "api_tokens" WHERE "token_hash" = ${tokenHash} LIMIT 1`,
  )) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  const expiresAt = row.expires_at == null ? null : Number(row.expires_at);
  if (expiresAt !== null && expiresAt <= now()) return null;
  await db.run(sql`UPDATE "api_tokens" SET "last_used_at" = ${now()} WHERE "id" = ${row.id}`);
  return {
    id: String(row.id),
    name: String(row.name),
    scopes: row.scopes ? (JSON.parse(String(row.scopes)) as string[]) : [],
    createdBy: row.created_by == null ? null : String(row.created_by),
  };
}

/** Token-Liste (ohne Hash/Klartext) — für die Admin-Verwaltung. */
export async function listApiTokens(db: DrizzleDatabase): Promise<
  {
    id: string;
    name: string;
    scopes: string[];
    createdBy: string | null;
    expiresAt: number | null;
    lastUsedAt: number | null;
  }[]
> {
  const rows = (await db.all(
    sql`SELECT "id", "name", "scopes", "created_by", "expires_at", "last_used_at" FROM "api_tokens" ORDER BY "name" ASC`,
  )) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    scopes: row.scopes ? (JSON.parse(String(row.scopes)) as string[]) : [],
    createdBy: row.created_by == null ? null : String(row.created_by),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    lastUsedAt: row.last_used_at == null ? null : Number(row.last_used_at),
  }));
}

/** Widerruft (löscht) ein Token. */
export async function revokeApiToken(db: DrizzleDatabase, id: string): Promise<boolean> {
  const existing = (await db.all(
    sql`SELECT "id" FROM "api_tokens" WHERE "id" = ${id} LIMIT 1`,
  )) as Record<string, unknown>[];
  if (!existing[0]) return false;
  await db.run(sql`DELETE FROM "api_tokens" WHERE "id" = ${id}`);
  return true;
}

/** Prüft, ob die Scopes des Principals einen benötigten Scope abdecken. */
export function hasScope(scopes: string[], needed: Scope): boolean {
  return scopes.includes('admin') || scopes.includes(needed);
}

/** Bildet einen Token-Principal auf einen AuthUser ab (für Policies). */
export function tokenToUser(principal: TokenPrincipal): AuthUser {
  return {
    id: principal.createdBy ?? `token:${principal.id}`,
    email: principal.name,
    groups: principal.scopes.includes('admin') ? ['admin'] : [],
  };
}
