import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { collectionSnapshot } from '../db/diff.js';
import { migrationSnapshot } from '../db/migrate.js';
import { field } from '../fields/index.js';
import { runDoctor } from './doctor.js';

const v1 = defineCollection({
  name: 'blog',
  version: 1,
  fields: { title: field.text({ required: true }), slug: field.slug({ indexed: true }) },
});

describe('runDoctor', () => {
  it('passes when schema is in sync and secrets present', () => {
    const report = runDoctor({
      collections: [v1],
      previousSchemaSnapshot: collectionSnapshot([v1]),
      previousMigrationSnapshot: migrationSnapshot([v1]),
      env: { ACCESS_TEAM_DOMAIN: 'casoon' },
      requiredSecrets: ['ACCESS_TEAM_DOMAIN'],
    });
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.name === 'migration-drift')?.status).toBe('ok');
  });

  it('fails on a missing secret', () => {
    const report = runDoctor({
      collections: [v1],
      previousMigrationSnapshot: migrationSnapshot([v1]),
      env: {},
      requiredSecrets: ['ACCESS_TEAM_DOMAIN'],
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((c) => c.name === 'secrets')?.status).toBe('error');
  });

  it('fails on migration drift (collection changed, no migration)', () => {
    const changed = defineCollection({
      name: 'blog',
      version: 1,
      fields: { title: field.text({ required: true }), extra: field.text() },
    });
    const report = runDoctor({
      collections: [changed],
      previousMigrationSnapshot: migrationSnapshot([v1]),
    });
    expect(report.checks.find((c) => c.name === 'migration-drift')?.status).toBe('error');
    expect(report.ok).toBe(false);
  });

  it('fails on a breaking schema change', () => {
    const breaking = defineCollection({
      name: 'blog',
      version: 2,
      // dropping a field is breaking
      fields: { title: field.text({ required: true }) },
    });
    const report = runDoctor({
      collections: [breaking],
      previousSchemaSnapshot: collectionSnapshot([v1]),
      previousMigrationSnapshot: migrationSnapshot([breaking]),
    });
    expect(report.checks.find((c) => c.name === 'schema-breaking')?.status).toBe('error');
    expect(report.ok).toBe(false);
  });

  it('flags missing bindings when a live env is provided', () => {
    const report = runDoctor({
      collections: [v1],
      previousMigrationSnapshot: migrationSnapshot([v1]),
      bindings: { DB: {}, MEDIA: {} }, // CACHE missing
    });
    const bindings = report.checks.find((c) => c.name === 'bindings');
    expect(bindings?.status).toBe('error');
    expect(bindings?.detail).toContain('CACHE');
  });

  it('skips live checks without a live env', () => {
    const report = runDoctor({
      collections: [v1],
      previousMigrationSnapshot: migrationSnapshot([v1]),
    });
    expect(report.checks.find((c) => c.name === 'bindings')?.status).toBe('skipped');
    expect(report.checks.find((c) => c.name === 'tables')?.status).toBe('skipped');
  });
});
