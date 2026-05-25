/**
 * Access-Control über benannte, kombinierbare Policies (statt Inline-Lambdas).
 * Testbar, cachebar, auditierbar, wiederverwendbar. Siehe ARCHITECTURE §6.
 */

export interface PolicyContext<Doc = unknown, User = unknown> {
  user?: User;
  doc?: Doc;
}

export type PolicyFn<Doc = unknown, User = unknown> = (
  ctx: PolicyContext<Doc, User>,
) => boolean | Promise<boolean>;

export interface Policy<Doc = unknown, User = unknown> {
  readonly name: string;
  // Method signature (bivariant params) so a typed Policy<Doc, User> stays
  // assignable to Policy<unknown, unknown> in collection access rules.
  check(ctx: PolicyContext<Doc, User>): boolean | Promise<boolean>;
}

export function definePolicy<Doc = unknown, User = unknown>(
  name: string,
  check: PolicyFn<Doc, User>,
): Policy<Doc, User> {
  return { name, check };
}

/** Alle Policies müssen zutreffen. */
export function allOf(...policies: Policy[]): Policy {
  return definePolicy(`allOf(${policies.map((p) => p.name).join(', ')})`, async (ctx) => {
    for (const p of policies) {
      if (!(await p.check(ctx))) return false;
    }
    return true;
  });
}

/** Mindestens eine Policy muss zutreffen. */
export function anyOf(...policies: Policy[]): Policy {
  return definePolicy(`anyOf(${policies.map((p) => p.name).join(', ')})`, async (ctx) => {
    for (const p of policies) {
      if (await p.check(ctx)) return true;
    }
    return false;
  });
}

export interface AccessRules {
  read?: Policy;
  write?: Policy;
}
