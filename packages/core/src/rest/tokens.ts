/**
 * API-Token-Oberfläche (M2-7): Auth-Middleware (Bearer), Scope-Guard und die
 * Verwaltungs-Routen (Ausstellen/Auflisten/Widerrufen). Tokens sind eine
 * Alternative zur Browser-Session — ist ein gültiges Bearer-Token gesetzt, wird
 * daraus `c.var.user` + `c.var.scopes` abgeleitet; sonst greift der Session-Pfad.
 */

import { type Context, Hono, type MiddlewareHandler } from 'hono';
import {
  createApiToken,
  hasScope,
  listApiTokens,
  revokeApiToken,
  type Scope,
  tokenToUser,
  verifyApiToken,
} from '../auth/tokens.js';
import type { AuthUser, Platform } from '../platform/index.js';

type Env = { Variables: { platform: Platform; user?: AuthUser; scopes?: string[] } };

/**
 * Liest `Authorization: Bearer <token>`. Gültiges Token → setzt `scopes` + `user`
 * (Token-Owner). Ungültiges Token → 401. Kein Token → unverändert weiter
 * (Session/Access-Pfad).
 */
export function apiTokenAuth(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (header?.startsWith('Bearer ')) {
      const principal = await verifyApiToken(c.var.platform.db, header.slice(7).trim());
      if (!principal) return c.json({ error: 'invalid token' }, 401);
      c.set('scopes', principal.scopes);
      c.set('user', tokenToUser(principal));
    }
    await next();
  };
}

const SCOPE_FOR_METHOD = (method: string): Scope =>
  method === 'GET' || method === 'HEAD' ? 'content:read' : 'content:write';

/**
 * Erzwingt den methoden-abhängigen Scope, *wenn* per Token authentifiziert wurde.
 * Ohne Token (Session-Pfad) ist der Guard ein No-op — dort greifen die
 * Collection-Policies.
 */
export function tokenScopeGuard(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const scopes = c.var.scopes;
    if (!scopes) return next();
    const needed = SCOPE_FOR_METHOD(c.req.method);
    if (!hasScope(scopes, needed)) return c.json({ error: 'insufficient scope', needed }, 403);
    await next();
  };
}

/** Default-Manage-Guard: nur Nutzer/Token mit `admin`-Gruppe bzw. -Scope. */
function defaultCanManage(c: Context<Env>): boolean {
  if (c.var.scopes) return hasScope(c.var.scopes, 'admin');
  return Boolean(c.var.user?.groups?.includes('admin'));
}

export interface TokenRoutesOptions {
  /** Überschreibt, wer Tokens verwalten darf (Standard: admin-Gruppe/-Scope). */
  canManage?: (c: Context<Env>) => boolean;
}

/**
 * Verwaltungs-Routen, gemountet unter `/api/internal/tokens`:
 *   POST   /   → Token ausstellen (Body: { name, scopes, expiresAt?, revoke? }) → { id, token }
 *   GET    /   → Tokens auflisten (ohne Klartext)
 *   DELETE /:id → Token widerrufen
 */
export function tokenRoutes(options: TokenRoutesOptions = {}) {
  const canManage = options.canManage ?? defaultCanManage;
  return new Hono<Env>()
    .use('*', async (c, next) => {
      if (!canManage(c)) return c.json({ error: 'forbidden' }, 403);
      await next();
    })
    .post('/', async (c) => {
      const body = (await c.req.json().catch(() => null)) as {
        name?: string;
        scopes?: string[];
        expiresAt?: number | null;
        revoke?: string;
      } | null;
      if (!body?.name || !Array.isArray(body.scopes) || body.scopes.length === 0) {
        return c.json({ error: 'name and scopes are required' }, 400);
      }
      const issued = await createApiToken(c.var.platform.db, {
        name: body.name,
        scopes: body.scopes,
        createdBy: c.var.user?.id ?? null,
        expiresAt: body.expiresAt ?? null,
        revoke: body.revoke,
      });
      return c.json(issued, 201);
    })
    .get('/', async (c) => c.json(await listApiTokens(c.var.platform.db)))
    .delete('/:id', async (c) => {
      const ok = await revokeApiToken(c.var.platform.db, c.req.param('id'));
      return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
    });
}
