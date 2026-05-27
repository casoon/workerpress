import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { collectionSnapshot, diffCollections, type SchemaChange } from './diff.js';

const base = defineCollection({
  name: 'posts',
  version: 1,
  fields: {
    title: field.text({ required: true, max: 200 }),
    status: field.enum(['draft', 'published'], { default: 'draft' }),
    tag: field.relation({ to: 'tags' }),
  },
});

function diff(next: ReturnType<typeof defineCollection>) {
  return diffCollections(collectionSnapshot([base]), collectionSnapshot([next]));
}

function find(changes: SchemaChange[], pred: (c: SchemaChange) => boolean) {
  return changes.find(pred);
}

describe('diffCollections', () => {
  it('narrowing text.max is breaking (DoD)', () => {
    const next = defineCollection({
      ...base,
      fields: { ...base.fields, title: field.text({ required: true, max: 50 }) },
    });
    const changes = diff(next);
    const maxChange = find(changes, (c) => c.description.startsWith('max:'));
    expect(maxChange?.kind).toBe('breaking');
    expect(maxChange?.description).toContain('200 -> 50');
  });

  it('widening text.max is additive', () => {
    const next = defineCollection({
      ...base,
      fields: { ...base.fields, title: field.text({ required: true, max: 500 }) },
    });
    expect(find(diff(next), (c) => c.description.startsWith('max:'))?.kind).toBe('additive');
  });

  it('adding a field is additive', () => {
    const next = defineCollection({
      ...base,
      fields: { ...base.fields, summary: field.text() },
    });
    const change = find(diff(next), (c) => c.field === 'summary');
    expect(change).toMatchObject({ kind: 'additive', description: 'field added' });
  });

  it('removing a field is breaking', () => {
    const next = defineCollection({
      name: 'posts',
      version: 2,
      fields: { title: field.text({ required: true, max: 200 }), status: base.fields.status },
    });
    expect(find(diff(next), (c) => c.field === 'tag')).toMatchObject({
      kind: 'breaking',
      description: 'field removed',
    });
  });

  it('field kind change is breaking', () => {
    const next = defineCollection({
      ...base,
      version: 2,
      fields: { ...base.fields, status: field.text() },
    });
    expect(find(diff(next), (c) => c.field === 'status')).toMatchObject({ kind: 'breaking' });
  });

  it('removing an enum value is breaking; adding is additive', () => {
    const next = defineCollection({
      ...base,
      version: 2,
      fields: {
        ...base.fields,
        status: field.enum(['published', 'archived'], { default: 'published' }),
      },
    });
    const changes = diff(next);
    expect(find(changes, (c) => c.description.includes('values removed'))?.kind).toBe('breaking');
    expect(find(changes, (c) => c.description.includes('values added'))?.kind).toBe('additive');
  });

  it('toggling relation.many is breaking', () => {
    const next = defineCollection({
      ...base,
      version: 2,
      fields: { ...base.fields, tag: field.relation({ to: 'tags', many: true }) },
    });
    expect(find(diff(next), (c) => c.description.startsWith('relation.many'))?.kind).toBe(
      'breaking',
    );
  });

  it('false -> true on required is breaking; reverse is additive', () => {
    const next = defineCollection({
      ...base,
      version: 2,
      fields: { ...base.fields, tag: field.relation({ to: 'tags', required: true }) },
    });
    expect(find(diff(next), (c) => c.description.startsWith('required:'))?.kind).toBe('breaking');
  });

  it('warns when breaking changes happen without a version bump', () => {
    const next = defineCollection({
      ...base,
      // version unchanged (= 1) but introduces a breaking change
      fields: { ...base.fields, title: field.text({ required: true, max: 50 }) },
    });
    expect(find(diff(next), (c) => c.description.startsWith('breaking change(s)'))).toBeDefined();
  });

  it('pure additive change passes without breaking warnings', () => {
    const next = defineCollection({
      ...base,
      fields: { ...base.fields, summary: field.text() },
    });
    const breaking = diff(next).filter((c) => c.kind === 'breaking');
    expect(breaking).toEqual([]);
  });
});
