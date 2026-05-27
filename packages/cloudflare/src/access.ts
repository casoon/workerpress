/**
 * Cloudflare-Access-Implementierung des Platform-Auth-Kontrakts (M1-7).
 * Verifiziert das von Access vorangestellte `Cf-Access-Jwt-Assertion`-JWT gegen
 * die JWKS des Teams und extrahiert Email/Gruppen. Keine eigene Datenhaltung.
 *
 * Dashboard-Setup: Zero Trust -> Access -> Applications -> self-hosted für
 * `/admin*` und `/api/internal/*`, Policy nach Email/Domain/Gruppe.
 */

import type { AuthUser, AuthVerifier } from '@workerpress/core';
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify, type KeyObject } from 'jose';

export interface CloudflareAccessAuthOptions {
  /** CF-Access-Team-Domain ohne Protokoll (z. B. `casoon` für casoon.cloudflareaccess.com). */
  teamDomain: string;
  /** Optional: AUD-Tag der Access-Application (oder mehrere). */
  audience?: string | string[];
}

type KeyInput = JWTVerifyGetKey | KeyObject | Uint8Array;

/** Generischer Verifier: nimmt einen JWKS-Resolver oder Schlüssel — testbar. */
export function createAccessVerifier(
  key: KeyInput,
  issuer: string,
  audience?: string | string[],
): AuthVerifier {
  return {
    async verify(request) {
      const token = request.headers.get('Cf-Access-Jwt-Assertion');
      if (!token) return null;
      try {
        const { payload } = await jwtVerify(token, key as JWTVerifyGetKey, { issuer, audience });
        const email = typeof payload.email === 'string' ? payload.email : undefined;
        if (!email) return null;
        const id = typeof payload.sub === 'string' ? payload.sub : email;
        const groups = Array.isArray(payload.groups)
          ? (payload.groups as unknown[]).filter((g): g is string => typeof g === 'string')
          : undefined;
        return { id, email, groups } satisfies AuthUser;
      } catch {
        return null;
      }
    },
  };
}

export function createCloudflareAccessAuth(options: CloudflareAccessAuthOptions): AuthVerifier {
  const issuer = `https://${options.teamDomain}.cloudflareaccess.com`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  return createAccessVerifier(jwks, issuer, options.audience);
}
