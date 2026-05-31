import { describe, expect, it } from 'vitest';
import { allOf, anyOf, definePolicy } from './index.js';

describe('definePolicy', () => {
  it('evaluates synchronous check', async () => {
    const p = definePolicy('always', () => true);
    expect(p.name).toBe('always');
    expect(await p.check({})).toBe(true);
  });

  it('evaluates asynchronous check', async () => {
    const p = definePolicy('async-deny', async () => false);
    expect(await p.check({})).toBe(false);
  });

  it('receives context', async () => {
    const p = definePolicy<unknown, { role: string }>('admin-only', ({ user }) => user?.role === 'admin');
    expect(await p.check({ user: { role: 'admin' } })).toBe(true);
    expect(await p.check({ user: { role: 'viewer' } })).toBe(false);
    expect(await p.check({})).toBe(false);
  });
});

describe('allOf', () => {
  const yes = definePolicy('yes', () => true);
  const no = definePolicy('no', () => false);

  it('passes when all policies pass', async () => {
    expect(await allOf(yes, yes).check({})).toBe(true);
  });

  it('fails when any policy fails', async () => {
    expect(await allOf(yes, no).check({})).toBe(false);
    expect(await allOf(no, yes).check({})).toBe(false);
  });

  it('short-circuits on first failure', async () => {
    let called = false;
    const spy = definePolicy('spy', () => { called = true; return true; });
    await allOf(no, spy).check({});
    expect(called).toBe(false);
  });

  it('includes policy names in composed name', () => {
    expect(allOf(yes, no).name).toBe('allOf(yes, no)');
  });
});

describe('anyOf', () => {
  const yes = definePolicy('yes', () => true);
  const no = definePolicy('no', () => false);

  it('passes when at least one policy passes', async () => {
    expect(await anyOf(no, yes).check({})).toBe(true);
    expect(await anyOf(yes, no).check({})).toBe(true);
  });

  it('fails when all policies fail', async () => {
    expect(await anyOf(no, no).check({})).toBe(false);
  });

  it('short-circuits on first success', async () => {
    let called = false;
    const spy = definePolicy('spy', () => { called = true; return false; });
    await anyOf(yes, spy).check({});
    expect(called).toBe(false);
  });

  it('includes policy names in composed name', () => {
    expect(anyOf(yes, no).name).toBe('anyOf(yes, no)');
  });
});
