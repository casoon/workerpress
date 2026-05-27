import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAccessVerifier } from './access.js';

const ISSUER = 'https://team.cloudflareaccess.com';

let privateKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

async function sign(payload: Record<string, unknown>, opts: { issuer?: string } = {}) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

function request(token?: string): Request {
  const headers = new Headers();
  if (token) headers.set('Cf-Access-Jwt-Assertion', token);
  return new Request('https://app.example/admin', { headers });
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, alg: 'RS256' }] });
});

describe('createAccessVerifier', () => {
  it('returns null without the Access JWT header', async () => {
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect(await verifier.verify(request())).toBeNull();
  });

  it('returns the user from a valid JWT (email + sub)', async () => {
    const token = await sign({ email: 'a@b.de', sub: 'user-1' });
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect(await verifier.verify(request(token))).toEqual({ id: 'user-1', email: 'a@b.de' });
  });

  it('extracts groups when present', async () => {
    const token = await sign({ email: 'a@b.de', sub: 'u1', groups: ['admin', 'editor'] });
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect((await verifier.verify(request(token)))?.groups).toEqual(['admin', 'editor']);
  });

  it('rejects a JWT signed by another issuer', async () => {
    const token = await sign({ email: 'a@b.de' }, { issuer: 'https://other.example' });
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect(await verifier.verify(request(token))).toBeNull();
  });

  it('rejects a malformed token', async () => {
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect(await verifier.verify(request('not-a-jwt'))).toBeNull();
  });

  it('rejects a valid JWT that lacks an email claim', async () => {
    const token = await sign({ sub: 'u1' });
    const verifier = createAccessVerifier(jwks, ISSUER);
    expect(await verifier.verify(request(token))).toBeNull();
  });
});
