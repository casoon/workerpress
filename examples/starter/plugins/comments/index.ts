import { defineCollection, definePlugin, field } from '@workerpress/core';
import { Hono } from 'hono';

/**
 * Beispiel-Plugin `comments` (M2-1-Smoke). Bringt eine eigene Collection und
 * eine eigene Route mit. Allein durch Eintragen in `plugins/index.ts` wird es
 * aufgelöst und gemountet: die Collection bekommt REST-Routen + eine D1-Tabelle,
 * die Route ist unter /api/internal/plugins/comments/* erreichbar.
 */

const comments = defineCollection({
  name: 'comments',
  version: 1,
  labels: { singular: 'Kommentar', plural: 'Kommentare' },
  fields: {
    // Bezug auf den kommentierten Blog-Beitrag (einwertige Relation -> Spalte).
    post: field.relation({ to: 'blog', indexed: true }),
    author: field.text({ required: true, max: 120 }),
    body: field.text({ required: true, searchable: true }),
    status: field.enum(['pending', 'approved'], { default: 'pending', indexed: true }),
    createdAt: field.date(),
  },
});

// Eigene Plugin-Route. Wird vom Worker unter /api/internal/plugins eingehängt,
// d. h. erreichbar als GET /api/internal/plugins/comments/ping.
const commentsApi = new Hono().get('/ping', (c) => c.json({ plugin: 'comments', ok: true }));

export default definePlugin({
  name: 'comments',
  version: '0.1.0',
  collections: [comments],
  routes: (app) => app.route('/comments', commentsApi),
  admin: { nav: [{ label: 'Kommentare', path: '/admin/comments' }] },
  // Event-Bus-Smoke (M2-3): läuft async nach der Response, blockt sie nie.
  on: {
    'content.published': async ({ collection, id }) => {
      console.log(`[comments] reacting to content.published: ${collection}/${id}`);
    },
  },
});
