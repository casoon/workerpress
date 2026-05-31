import { describe, expect, it } from 'vitest';
import { defineCollection } from '../collections/index.js';
import { field } from '../fields/index.js';
import { definePlugin, describePlugins, resolvePlugins } from './index.js';

const comments = definePlugin({
  name: 'comments',
  version: '0.1.0',
  collections: [
    defineCollection({ name: 'comments', fields: { body: field.text({ required: true }) } }),
  ],
  routes: (app) => app,
  on: { 'content.published': () => {} },
  admin: { nav: [{ label: 'Comments', path: '/admin/comments' }] },
});

describe('resolvePlugins', () => {
  it('orders dependencies before dependents', () => {
    const a = definePlugin({ name: 'a', version: '1.0.0' });
    const b = definePlugin({ name: 'b', version: '1.0.0', dependsOn: ['a'] });
    const c = definePlugin({ name: 'c', version: '1.0.0', dependsOn: ['b'] });
    // Pass in reverse to prove ordering is by deps, not input order.
    const { plugins } = resolvePlugins([c, b, a]);
    expect(plugins.map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('aggregates collections and admin nav in dependency order', () => {
    const base = definePlugin({
      name: 'base',
      version: '1.0.0',
      collections: [defineCollection({ name: 'tags', fields: { name: field.text() } })],
      admin: { nav: [{ label: 'Tags', path: '/admin/tags' }] },
    });
    const dependent = definePlugin({ ...comments, dependsOn: ['base'] });
    const resolved = resolvePlugins([dependent, base]);
    expect(resolved.collections.map((c) => c.name)).toEqual(['tags', 'comments']);
    expect(resolved.adminNav.map((n) => n.label)).toEqual(['Tags', 'Comments']);
  });

  it('throws on a missing dependency', () => {
    const x = definePlugin({ name: 'x', version: '1.0.0', dependsOn: ['ghost'] });
    expect(() => resolvePlugins([x])).toThrow(/unknown plugin 'ghost'/);
  });

  it('throws on a dependency cycle', () => {
    const a = definePlugin({ name: 'a', version: '1.0.0', dependsOn: ['b'] });
    const b = definePlugin({ name: 'b', version: '1.0.0', dependsOn: ['a'] });
    expect(() => resolvePlugins([a, b])).toThrow(/cycle/);
  });

  it('throws on duplicate plugin names', () => {
    const a = definePlugin({ name: 'dup', version: '1.0.0' });
    const b = definePlugin({ name: 'dup', version: '2.0.0' });
    expect(() => resolvePlugins([a, b])).toThrow(/Duplicate plugin name: dup/);
  });
});

describe('describePlugins', () => {
  it('lists plugins with their collections, routes, hooks and events', () => {
    const out = describePlugins([comments]);
    expect(out).toContain('## Plugins (1)');
    expect(out).toContain('- comments@0.1.0');
    expect(out).toContain('collections: comments');
    expect(out).toContain('routes: yes');
    expect(out).toContain('events: content.published');
  });

  it('reports an empty registry', () => {
    expect(describePlugins([])).toContain('## Plugins (0)');
  });
});
