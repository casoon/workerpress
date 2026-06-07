/**
 * Auth-Stub — wird vom Scaffolder je nach gewähltem Provider überschrieben.
 */
import type { AuthUser } from '@workerpress/core';

const DEV_USER: AuthUser = { id: 'demo', email: 'demo@local', groups: ['admin'] };

export async function resolveUser(_request: Request): Promise<AuthUser | null> {
  return import.meta.env.DEV ? DEV_USER : null;
}
