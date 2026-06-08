/**
 * Hook-Runner (M2-2) — führt synchrone Lifecycle-Hooks deterministisch aus.
 *
 * Reihenfolge: aufsteigend nach `priority` (Standard 0), bei Gleichstand stabil
 * in Registrierungsreihenfolge. Hooks laufen sequenziell und werden `await`-ed;
 * ein `throw` propagiert nach oben (in `internalRoutes` -> HTTP 422).
 */

import type { HookContext, HookEntry, HookFn } from '../collections/index.js';

interface Indexed {
  handler: HookFn;
  priority: number;
  order: number;
}

/** Normalisiert Einträge und sortiert sie in Ausführungsreihenfolge. */
export function sortHooks(entries: HookEntry[] = []): HookFn[] {
  return entries
    .map<Indexed>((entry, order) =>
      typeof entry === 'function'
        ? { handler: entry, priority: 0, order }
        : { handler: entry.handler, priority: entry.priority ?? 0, order },
    )
    .sort((a, b) => a.priority - b.priority || a.order - b.order)
    .map((e) => e.handler);
}

/** Führt alle Hooks einer Phase nacheinander aus. Wirft, sobald ein Hook wirft. */
export async function runHooks(entries: HookEntry[] | undefined, ctx: HookContext): Promise<void> {
  for (const handler of sortHooks(entries)) {
    await handler(ctx);
  }
}
