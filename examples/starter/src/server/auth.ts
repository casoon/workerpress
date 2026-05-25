import { betterAuth } from 'better-auth';

/**
 * Better Auth — eine Session-Quelle für UI (Astro-Middleware) und API (Hono-Middleware).
 * Siehe ARCHITECTURE §6. Der Drizzle-Adapter wird mit der Platform-DB verdrahtet.
 */
export const auth = (_env: unknown) =>
  betterAuth({
    emailAndPassword: { enabled: true },
  });

export async function getSession(
  _request: Request,
  _env: unknown,
): Promise<{ user: unknown } | null> {
  // ACHTUNG: Platzhalter OHNE echte Authentifizierung. Bis Better Auth (#15)
  // verdrahtet ist, ist /admin ungeschützt — nicht mit echten Daten betreiben.
  return { user: { id: 'demo', role: 'admin' } };
}
