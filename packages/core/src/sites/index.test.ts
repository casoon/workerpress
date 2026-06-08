import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { generateMigration } from '../db/migrate.js';
import { collectionRepository } from '../db/repository.js';
import { field } from '../fields/index.js';
import {
  defineSite,
  describeSites,
  listSites,
  resolveSite,
  seedSites,
  sitesTableSql,
} from './index.js';

const main = defineSite({ id: 'main', role: 'main', host: 'example.com', name: 'Main' });
const landing = defineSite({
  id: 'launch',
  role: 'landing',
  host: 'launch.example.com',
  name: 'Launch',
});
const sites = [main, landing];

describe('resolveSite', () => {
  it('matches by host (port-insensitive) and falls back to null', () => {
    expect(resolveSite(sites, 'launch.example.com')?.id).toBe('launch');
    expect(resolveSite(sites, 'example.com:8787')?.id).toBe('main');
    expect(resolveSite(sites, 'unknown.com')).toBeNull();
    expect(resolveSite(sites, undefined)).toBeNull();
  });

  it('accepts an x-site id override', () => {
    expect(resolveSite(sites, 'launch')?.id).toBe('launch');
  });

  it('prefers the longest matching pathPrefix on a shared host', () => {
    const a = defineSite({ id: 'a', role: 'landing', host: 'h.com', pathPrefix: '/de', name: 'A' });
    const b = defineSite({ id: 'b', role: 'main', host: 'h.com', name: 'B' });
    expect(resolveSite([b, a], 'h.com', '/de/x')?.id).toBe('a');
    expect(resolveSite([b, a], 'h.com', '/en')?.id).toBe('b');
  });
});

describe('describeSites', () => {
  it('lists registered sites', () => {
    const out = describeSites(sites);
    expect(out).toContain('## Sites (2)');
    expect(out).toContain('[main] Main — example.com');
    expect(out).toContain('[landing] Launch — launch.example.com');
  });
});

const posts = defineCollection({
  name: 'posts',
  fields: {
    title: field.text({ required: true }),
    status: field.enum(['draft', 'published'], { default: 'draft' }),
    site: field.relation({ to: 'sites', indexed: true }),
  },
});

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = drizzle(client);
  await client.executeMultiple(generateMigration([posts]).sql as string);
  await client.executeMultiple(sitesTableSql());
  return db;
}

describe('seedSites + listSites', () => {
  it('upserts sites idempotently', async () => {
    const db = await setup();
    await seedSites(db, sites);
    await seedSites(db, sites); // second run must not duplicate
    const stored = await listSites(db);
    expect(stored.map((s) => s.id).sort()).toEqual(['launch', 'main']);
  });
});

describe('multi-site content filter (repository.find)', () => {
  it('returns site-own + global content, excludes other sites', async () => {
    const db = await setup();
    const repo = collectionRepository(db, posts);
    await repo.create({ title: 'global', status: 'published' }); // site = null
    await repo.create({ title: 'main-only', status: 'published', site: 'main' });
    await repo.create({ title: 'launch-only', status: 'published', site: 'launch' });

    const forLaunch = await repo.find({ site: 'launch', publishedOnly: true });
    expect(forLaunch.map((r) => r.title).sort()).toEqual(['global', 'launch-only']);

    const globalOnly = await repo.find({ site: null, publishedOnly: true });
    expect(globalOnly.map((r) => r.title)).toEqual(['global']);

    const all = await repo.find({ publishedOnly: true });
    expect(all).toHaveLength(3);
  });
});
