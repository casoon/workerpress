import { describe, expect, it } from 'vitest';
import type { HookContext, HookEntry } from '../collections/index.js';
import { runHooks, sortHooks } from './index.js';

function ctx(doc: Record<string, unknown> = {}): HookContext {
  return { doc, collection: 'test', operation: 'create' };
}

describe('sortHooks', () => {
  it('returns [] for undefined', () => {
    expect(sortHooks(undefined)).toEqual([]);
  });

  it('treats a bare function as priority 0', () => {
    const fn = () => {};
    expect(sortHooks([fn])).toEqual([fn]);
  });

  it('orders ascending by priority', () => {
    const calls: string[] = [];
    const entries: HookEntry[] = [
      { handler: () => void calls.push('c'), priority: 10 },
      { handler: () => void calls.push('a'), priority: -5 },
      { handler: () => void calls.push('b'), priority: 0 },
    ];
    for (const h of sortHooks(entries)) h(ctx());
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('is stable for equal priorities (registration order)', () => {
    const calls: string[] = [];
    const entries: HookEntry[] = [
      () => void calls.push('1'),
      { handler: () => void calls.push('2'), priority: 0 },
      () => void calls.push('3'),
    ];
    for (const h of sortHooks(entries)) h(ctx());
    expect(calls).toEqual(['1', '2', '3']);
  });
});

describe('runHooks', () => {
  it('runs hooks in priority order and lets them mutate doc', async () => {
    const doc: Record<string, unknown> = { title: 'Hello World' };
    await runHooks(
      [
        {
          handler: (c) => {
            c.doc.seen = `${c.doc.slug}`;
          },
          priority: 5,
        },
        {
          handler: (c) => {
            if (!c.doc.slug && typeof c.doc.title === 'string') {
              c.doc.slug = c.doc.title.toLowerCase().replace(/\s+/g, '-');
            }
          },
          priority: -1,
        },
      ],
      { doc, collection: 'blog', operation: 'create' },
    );
    expect(doc.slug).toBe('hello-world');
    expect(doc.seen).toBe('hello-world'); // higher-priority hook saw the slug
  });

  it('awaits async hooks sequentially', async () => {
    const calls: string[] = [];
    await runHooks(
      [
        async () => {
          await Promise.resolve();
          calls.push('a');
        },
        () => void calls.push('b'),
      ],
      ctx(),
    );
    expect(calls).toEqual(['a', 'b']);
  });

  it('propagates a thrown error and stops the chain', async () => {
    const calls: string[] = [];
    await expect(
      runHooks(
        [
          () => void calls.push('first'),
          () => {
            throw new Error('blocked');
          },
          () => void calls.push('never'),
        ],
        ctx(),
      ),
    ).rejects.toThrow('blocked');
    expect(calls).toEqual(['first']);
  });

  it('is a no-op for undefined entries', async () => {
    await expect(runHooks(undefined, ctx())).resolves.toBeUndefined();
  });
});
