import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser, Platform } from '../platform/index.js';
import { apiTokenAuth, tokenRoutes, tokenScopeGuard } from '../rest/tokens.js';
import {
  apiTokensTableSql,
  createApiToken,
  hasScope,
  listApiTokens,
  revokeApiToken,
  tokenToUser,
  verifyApiToken,
} from './tokens.js';

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  await client.executeMultiple(apiTokensTableSql());
  return db;
}

describe('API tokens', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('issues a token, returns plaintext once, stores only a hash', async () => {
    const issued = await createApiToken(db, { name: 'ci', scopes: ['content:read'] });
    expect(issued.token).toMatch(/^wp_/);
    const [stored] = await listApiTokens(db);
    expect(stored?.name).toBe('ci');
    // plaintext is not stored anywhere in the listing
    expect(JSON.stringify(stored)).not.toContain(issued.token);
  });

  it('verifies a valid token and rejects an unknown one', async () => {
    const issued = await createApiToken(db, { name: 'ci', scopes: ['content:read'] });
    const principal = await verifyApiToken(db, issued.token);
    expect(principal?.scopes).toEqual(['content:read']);
    expect(await verifyApiToken(db, 'wp_nope')).toBeNull();
  });

  it('rejects an expired token', async () => {
    const issued = await createApiToken(db, {
      name: 'old',
      scopes: ['admin'],
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });
    expect(await verifyApiToken(db, issued.token)).toBeNull();
  });

  it('rotates: issuing with revoke removes the old token', async () => {
    const first = await createApiToken(db, { name: 'k', scopes: ['content:read'] });
    const second = await createApiToken(db, {
      name: 'k',
      scopes: ['content:read'],
      revoke: first.id,
    });
    expect(await verifyApiToken(db, first.token)).toBeNull();
    expect(await verifyApiToken(db, second.token)).not.toBeNull();
  });

  it('revokes a token', async () => {
    const issued = await createApiToken(db, { name: 'k', scopes: ['admin'] });
    expect(await revokeApiToken(db, issued.id)).toBe(true);
    expect(await verifyApiToken(db, issued.token)).toBeNull();
  });

  it('hasScope: admin implies everything', () => {
    expect(hasScope(['admin'], 'content:write')).toBe(true);
    expect(hasScope(['content:read'], 'content:write')).toBe(false);
    expect(tokenToUser({ id: 't', name: 'n', scopes: ['admin'], createdBy: 'u1' }).groups).toEqual([
      'admin',
    ]);
  });
});

describe('token middleware + scope guard', () => {
  type Env = { Variables: { platform: Platform; user?: AuthUser; scopes?: string[] } };

  function app(db: ReturnType<typeof drizzle>) {
    const platform = { db } as unknown as Platform;
    return new Hono<Env>()
      .use('*', async (c, next) => {
        c.set('platform', platform);
        await next();
      })
      .use('*', apiTokenAuth())
      .use('*', tokenScopeGuard())
      .get('/content/blog', (c) => c.json({ ok: true }))
      .post('/content/blog', (c) => c.json({ created: true }, 201))
      .route('/tokens', tokenRoutes());
  }

  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('content:read token can GET but not POST', async () => {
    const { token } = await createApiToken(db, { name: 'ro', scopes: ['content:read'] });
    const a = app(db);
    const get = await a.request('/content/blog', { headers: { Authorization: `Bearer ${token}` } });
    expect(get.status).toBe(200);
    const post = await a.request('/content/blog', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(post.status).toBe(403);
  });

  it('invalid token yields 401', async () => {
    const a = app(db);
    const res = await a.request('/content/blog', { headers: { Authorization: 'Bearer wp_bad' } });
    expect(res.status).toBe(401);
  });

  it('admin token can manage tokens; read-only cannot', async () => {
    const admin = await createApiToken(db, { name: 'a', scopes: ['admin'] });
    const ro = await createApiToken(db, { name: 'r', scopes: ['content:read'] });
    const a = app(db);
    const issue = await a.request('/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'new', scopes: ['content:write'] }),
    });
    expect(issue.status).toBe(201);
    const denied = await a.request('/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ro.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', scopes: ['content:write'] }),
    });
    expect(denied.status).toBe(403);
  });
});
