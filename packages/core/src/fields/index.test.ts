import { describe, expect, it } from 'vitest';
import { defineField, field } from './index.js';

describe('field builder', () => {
  it('captures kind and options for a text field', () => {
    expect(field.text({ max: 10, required: true })).toEqual({
      kind: 'text',
      options: { max: 10, required: true },
    });
  });

  it('stores enum values in options', () => {
    expect(field.enum(['draft', 'published'])).toEqual({
      kind: 'enum',
      options: { values: ['draft', 'published'] },
    });
  });

  it('defaults options to an empty object', () => {
    expect(field.boolean()).toEqual({ kind: 'boolean', options: {} });
  });
});

describe('defineField', () => {
  it('returns the definition unchanged', () => {
    const def = defineField({ type: 'seo', fields: { title: field.text() } });
    expect(def.type).toBe('seo');
    expect(def.fields?.title).toEqual({ kind: 'text', options: {} });
  });
});
