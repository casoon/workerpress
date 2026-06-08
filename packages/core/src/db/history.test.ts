import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getVersion,
  listAudit,
  listVersions,
  platformTablesSql,
  recordAudit,
  recordVersion,
} from './history.js';

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  await client.executeMultiple(platformTablesSql());
  return db;
}

describe('content versions', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('auto-increments version per record', async () => {
    const a = await recordVersion(db, { collection: 'blog', recordId: 'x', data: { title: 'v1' } });
    const b = await recordVersion(db, { collection: 'blog', recordId: 'x', data: { title: 'v2' } });
    expect(a.version).toBe(1);
    expect(b.version).toBe(2);
  });

  it('isolates version counters across records and collections', async () => {
    await recordVersion(db, { collection: 'blog', recordId: 'x', data: {} });
    const other = await recordVersion(db, { collection: 'blog', recordId: 'y', data: {} });
    const page = await recordVersion(db, { collection: 'pages', recordId: 'x', data: {} });
    expect(other.version).toBe(1);
    expect(page.version).toBe(1);
  });

  it('lists versions newest-first and fetches a snapshot', async () => {
    await recordVersion(db, { collection: 'blog', recordId: 'x', data: { n: 1 }, changedBy: 'u1' });
    await recordVersion(db, { collection: 'blog', recordId: 'x', data: { n: 2 } });
    const list = await listVersions(db, 'blog', 'x');
    expect(list.map((v) => v.version)).toEqual([2, 1]);
    const snap = await getVersion(db, 'blog', 'x', 1);
    expect(snap?.data).toEqual({ n: 1 });
    expect(snap?.changedBy).toBe('u1');
  });

  it('returns null for a missing version', async () => {
    expect(await getVersion(db, 'blog', 'x', 99)).toBeNull();
  });
});

describe('audit log', () => {
  let db: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    db = await setup();
  });

  it('records actions including access-denied with policy + meta', async () => {
    await recordAudit(db, { action: 'create', collection: 'blog', recordId: 'x', user: 'u1' });
    await recordAudit(db, {
      action: 'access-denied',
      collection: 'blog',
      recordId: 'x',
      policy: 'onlyAdmins',
      meta: { reason: 'no group' },
    });
    const entries = await listAudit(db, 'blog');
    expect(entries).toHaveLength(2);
    const denied = entries.find((e) => e.action === 'access-denied');
    expect(denied?.policy).toBe('onlyAdmins');
    expect(denied?.meta).toEqual({ reason: 'no group' });
  });
});
