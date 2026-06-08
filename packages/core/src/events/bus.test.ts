import { describe, expect, it, vi } from 'vitest';
import type { Platform } from '../platform/index.js';
import { definePlugin } from '../plugins/index.js';
import {
  collectSubscribers,
  createEventBus,
  deliverQueuedEvent,
  describeSubscribers,
  type SubscriberMap,
} from './bus.js';

const fakePlatform = {} as Platform;

/** Defer, das die Arbeit sofort ausführt und ihr Promise sammelt (für await). */
function syncDefer() {
  const pending: Promise<void>[] = [];
  return {
    defer: (work: () => Promise<void>) => {
      pending.push(work());
    },
    settle: () => Promise.all(pending),
  };
}

const noSleep = () => Promise.resolve();

describe('collectSubscribers', () => {
  it('aggregates on-maps across plugins per event', () => {
    const a = definePlugin({ name: 'a', version: '1', on: { 'content.published': () => {} } });
    const b = definePlugin({ name: 'b', version: '1', on: { 'content.published': () => {} } });
    const map = collectSubscribers([a, b]);
    expect(map.get('content.published')).toHaveLength(2);
  });
});

describe('createEventBus', () => {
  it('delivers an event to all subscribers after the response (defer)', async () => {
    const seen: string[] = [];
    const subscribers: SubscriberMap = new Map([
      ['content.published', [async () => void seen.push('one'), async () => void seen.push('two')]],
    ]);
    const { defer, settle } = syncDefer();
    const bus = createEventBus({
      subscribers,
      platform: () => fakePlatform,
      defer,
      sleep: noSleep,
    });
    bus.emit('content.published', { collection: 'blog', id: '1', doc: {} });
    await settle();
    expect(seen.sort()).toEqual(['one', 'two']);
  });

  it('does nothing when there are no subscribers', () => {
    const defer = vi.fn();
    const bus = createEventBus({ subscribers: new Map(), platform: () => fakePlatform, defer });
    bus.emit('content.deleted', { collection: 'blog', id: '1' });
    expect(defer).not.toHaveBeenCalled();
  });

  it('retries a failing subscriber up to maxAttempts, then gives up without throwing', async () => {
    let calls = 0;
    const handler = vi.fn(async () => {
      calls++;
      throw new Error('boom');
    });
    const subscribers: SubscriberMap = new Map([['content.published', [handler]]]);
    const { defer, settle } = syncDefer();
    const onError = vi.fn();
    const bus = createEventBus({
      subscribers,
      platform: () => fakePlatform,
      defer,
      maxAttempts: 3,
      sleep: noSleep,
      onError,
    });
    bus.emit('content.published', { collection: 'blog', id: '1', doc: {} });
    await settle();
    expect(calls).toBe(3);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('isolates a failing subscriber from a healthy one', async () => {
    const ok = vi.fn(async () => {});
    const bad = vi.fn(async () => {
      throw new Error('nope');
    });
    const subscribers: SubscriberMap = new Map([['content.published', [bad, ok]]]);
    const { defer, settle } = syncDefer();
    const bus = createEventBus({
      subscribers,
      platform: () => fakePlatform,
      defer,
      maxAttempts: 1,
      sleep: noSleep,
      onError: () => {},
    });
    bus.emit('content.published', { collection: 'blog', id: '1', doc: {} });
    await settle();
    expect(ok).toHaveBeenCalledOnce();
  });

  it('routes to the queue transport when configured (no inline delivery)', async () => {
    const handler = vi.fn(async () => {});
    const subscribers: SubscriberMap = new Map([['content.published', [handler]]]);
    const send = vi.fn(async () => {});
    const { defer, settle } = syncDefer();
    const bus = createEventBus({
      subscribers,
      platform: () => fakePlatform,
      defer,
      queue: { send },
    });
    bus.emit('content.published', { collection: 'blog', id: '1', doc: {} });
    await settle();
    expect(send).toHaveBeenCalledWith({
      event: 'content.published',
      payload: { collection: 'blog', id: '1', doc: {} },
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('deliverQueuedEvent', () => {
  it('runs subscribers and lets errors bubble for queue-level retry', async () => {
    const handler = vi.fn(async () => {
      throw new Error('retry me');
    });
    const subscribers: SubscriberMap = new Map([['content.published', [handler]]]);
    await expect(
      deliverQueuedEvent(
        { event: 'content.published', payload: { collection: 'blog', id: '1', doc: {} } },
        { platform: fakePlatform, subscribers },
      ),
    ).rejects.toThrow('retry me');
  });
});

describe('describeSubscribers', () => {
  it('summarizes subscribers per event type', () => {
    const p = definePlugin({
      name: 'comments',
      version: '1',
      on: { 'content.published': async function react() {} },
    });
    const out = describeSubscribers([p]);
    expect(out).toContain('content.published: 1');
    expect(out).toContain('react');
  });
});
