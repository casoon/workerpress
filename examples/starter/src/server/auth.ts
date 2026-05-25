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
  // Stub bis Better Auth (#15) verdrahtet ist. Nur im Dev-Modus eine Session,
  // damit /admin lokal testbar ist; in Produktion bleibt /admin gesperrt.
  if (import.meta.env.DEV) {
    return { user: { id: 'dev', role: 'admin' } };
  }
  return null;
}
