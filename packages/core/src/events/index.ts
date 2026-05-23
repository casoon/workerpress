/**
 * Event-System — zusätzlich zu Hooks. Hooks sind synchron im Request-Pfad;
 * Events laufen nach der Response (async, Retry, Queue-fähig). Siehe ARCHITECTURE §7.
 */

import type { EventBus } from '../platform/index.js';

export interface CmsEventPayloads {
  'content.created': { collection: string; id: string; doc: unknown };
  'content.published': { collection: string; id: string; doc: unknown };
  'content.deleted': { collection: string; id: string };
  'media.uploaded': { key: string; size: number };
}

export type CmsEventName = keyof CmsEventPayloads;

export type EventHandler<E extends CmsEventName> = (
  payload: CmsEventPayloads[E],
  ctx: { platform: import('../platform/index.js').Platform },
) => void | Promise<void>;

/** Wird im Request-Context an einen konkreten Bus gebunden (Cloudflare Queues o. Ä.). */
export function emit<E extends CmsEventName>(
  bus: EventBus,
  event: E,
  payload: CmsEventPayloads[E],
): void {
  bus.emit(event, payload);
}
