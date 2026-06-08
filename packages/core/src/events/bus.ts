/**
 * Event-Bus (M2-3) — async fan-out *nach* der Response. Getrennt von Hooks, die
 * synchron im Request-Pfad laufen (M2-2). Subscriber kommen aus den Plugins
 * (`definePlugin({ on })`); Zustellung läuft über `platform.defer` (Standard)
 * oder einen Cloudflare-Queues-Transport mit Retry. Siehe ARCHITECTURE §7.
 */

import type { EventBus, Platform } from '../platform/index.js';
import type { PluginConfig } from '../plugins/index.js';
import type { CmsEventName, CmsEventPayloads, EventHandler } from './index.js';

// biome-ignore lint/suspicious/noExplicitAny: Subscriber-Map ist über Event-Namen heterogen.
type AnyHandler = EventHandler<any>;

/** Subscriber je Event-Name, gesammelt aus allen Plugins (in Plugin-Reihenfolge). */
export type SubscriberMap = Map<CmsEventName, AnyHandler[]>;

/** Sammelt die `on`-Maps aller Plugins zu einer Event→Subscriber-Map. */
export function collectSubscribers(plugins: PluginConfig[]): SubscriberMap {
  const map: SubscriberMap = new Map();
  for (const plugin of plugins) {
    if (!plugin.on) continue;
    for (const [event, handler] of Object.entries(plugin.on)) {
      if (!handler) continue;
      const name = event as CmsEventName;
      const list = map.get(name) ?? [];
      list.push(handler as AnyHandler);
      map.set(name, list);
    }
  }
  return map;
}

/** Transport für queue-basierte Zustellung (Cloudflare Queues o. Ä.). */
export interface QueueTransport {
  send(message: { event: CmsEventName; payload: unknown }): Promise<void>;
}

export interface EventBusOptions {
  subscribers: SubscriberMap;
  /** Lazy, um die Zyklus-Abhängigkeit Bus↔Platform aufzulösen. */
  platform: () => Platform;
  /** Fire-and-forget-Scheduler (CF: `executionCtx.waitUntil`). */
  defer: (work: () => Promise<void>) => void;
  /** Optionaler Queue-Transport. Gesetzt → emit reicht an die Queue weiter. */
  queue?: QueueTransport;
  /** Maximale Zustellversuche im defer-Pfad (Standard 3). */
  maxAttempts?: number;
  /** Backoff in ms je Versuch (Standard: exponentiell 100·2^n). */
  backoff?: (attempt: number) => number;
  /** Injizierbar für Tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Wird bei endgültigem Fehlschlag eines Subscribers aufgerufen (Logging). */
  onError?: (event: CmsEventName, error: unknown) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
const defaultBackoff = (attempt: number): number => 100 * 2 ** attempt;

/**
 * Führt einen Subscriber mit Retry aus (exponentieller Backoff). Fehler werden
 * nach `maxAttempts` Versuchen geschluckt (geloggt) — ein fehlerhafter
 * Subscriber darf die übrigen nicht blockieren und nie die Response betreffen.
 */
async function deliverWithRetry(
  handler: AnyHandler,
  payload: unknown,
  ctx: { platform: Platform },
  opts: {
    maxAttempts: number;
    backoff: (n: number) => number;
    sleep: (ms: number) => Promise<void>;
  },
  onFinalError: (error: unknown) => void,
): Promise<void> {
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      await handler(payload, ctx);
      return;
    } catch (error) {
      if (attempt + 1 >= opts.maxAttempts) {
        onFinalError(error);
        return;
      }
      await opts.sleep(opts.backoff(attempt));
    }
  }
}

/**
 * Baut einen typisierten Event-Bus. `emit` kehrt sofort zurück; die Zustellung
 * läuft entkoppelt (defer) bzw. über die Queue. Mit Queue-Transport übernimmt
 * die Queue das Retry; im defer-Pfad macht es der Bus selbst.
 */
export function createEventBus(opts: EventBusOptions): EventBus {
  const maxAttempts = opts.maxAttempts ?? 3;
  const backoff = opts.backoff ?? defaultBackoff;
  const sleep = opts.sleep ?? defaultSleep;
  const onError =
    opts.onError ??
    ((event, error) => console.error(`[workerpress] event subscriber failed: ${event}`, error));

  return {
    emit(event, payload) {
      const name = event as CmsEventName;
      const handlers = opts.subscribers.get(name);
      if (!handlers || handlers.length === 0) return;
      if (opts.queue) {
        // Queue übernimmt Persistenz + Retry; nur die Übergabe deferren.
        const queue = opts.queue;
        opts.defer(() => queue.send({ event: name, payload }));
        return;
      }
      const ctx = { platform: opts.platform() };
      for (const handler of handlers) {
        opts.defer(() =>
          deliverWithRetry(handler, payload, ctx, { maxAttempts, backoff, sleep }, (error) =>
            onError(name, error),
          ),
        );
      }
    },
  };
}

/**
 * Consumer-Seite des Queue-Transports: verarbeitet eine vom Worker empfangene
 * Event-Nachricht. Wirft bei Fehler weiter — Cloudflare Queues stellt dann
 * gemäß `max_retries` erneut zu (das ist hier die Retry-Quelle, nicht der Bus).
 */
export async function deliverQueuedEvent(
  message: { event: CmsEventName; payload: unknown },
  ctx: { platform: Platform; subscribers: SubscriberMap },
): Promise<void> {
  const handlers = ctx.subscribers.get(message.event) ?? [];
  for (const handler of handlers) {
    await handler(message.payload as CmsEventPayloads[CmsEventName], { platform: ctx.platform });
  }
}

/** Menschenlesbare Subscriber-Übersicht je Event-Typ (für `cms inspect`). */
export function describeSubscribers(plugins: PluginConfig[]): string {
  const map = collectSubscribers(plugins);
  if (map.size === 0) return '## Event subscribers\n  none';
  const lines = ['## Event subscribers'];
  for (const [event, handlers] of map) {
    const names = handlers.map((h) => h.name || 'anonymous').join(', ');
    lines.push(`  ${event}: ${handlers.length} (${names})`);
  }
  return lines.join('\n');
}
