/**
 * Auth-Quelle für UI (Astro-Middleware) und API (Hono-Bootstrap).
 * Verifiziert Cloudflare-Access-JWTs (M1-7) — keine eigene Datenhaltung.
 *
 * Im Dev-Modus gibt's keinen Access-JWT; dann wird stellvertretend eine
 * Demo-Session zurückgegeben, damit /admin lokal testbar ist. In Produktion
 * gilt ausschließlich das verifizierte JWT.
 */

import { createCloudflareAccessAuth } from '@workerpress/cloudflare';
import type { AuthUser, AuthVerifier } from '@workerpress/core';

// TODO: an die echte Team-Domain anpassen (Zero Trust -> Settings -> Custom Pages).
const ACCESS_TEAM_DOMAIN = 'casoon';

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
