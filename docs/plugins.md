# Plugin-System

Plugins werden ohne manuelles Mounten geladen (Auto-Discovery, M2-1). Ein Plugin
bringt Collections, Routen, Hooks, Events und Admin-Erweiterungen mit.

```ts
import { defineCollection, definePlugin, field } from '@workerpress/core';
import { Hono } from 'hono';

const comments = defineCollection({ name: 'comments', fields: { body: field.text({ required: true }) } });
const api = new Hono().get('/ping', (c) => c.json({ ok: true }));

export default definePlugin({
  name: 'comments',
  version: '1.0.0',
  dependsOn: [],                 // topologisch sortiert
  collections: [comments],       // bekommt Tabelle + REST-Routen
  routes: (app) => app.route('/comments', api), // unter /api/internal/plugins/comments
  on: { 'content.published': async ({ id }) => { /* … */ } },
  admin: {
    nav: [{ label: 'Kommentare', path: '/admin/comments' }],
    widgets: [{ id: 'recent', title: 'Neueste', island: 'CommentsWidget' }],
    bulkActions: [{ id: 'approve', label: 'Freigeben', collection: 'comments', set: { status: 'approved' } }],
    views: [{ name: 'Ausstehend', where: { status: 'pending' }, collection: 'comments' }],
    fieldRenderers: [{ fieldType: 'richText', island: 'TipTap' }],
  },
});
```

Registrierung: einmal in `plugins/index.ts` eintragen — Worker-Mounting,
Migrations-Generierung und `cms`-Befehle lesen dieselbe Liste.

## Admin-Erweiterungspunkte (M3-4)

`resolveAdminExtensions(plugins)` führt alle Beiträge zusammen; das Admin-Layer
fragt sie ab:

- **Widgets** → Dashboard-Grid.
- **Bulk-Actions** (deklaratives `set`) → Tabellen-Toolbar bei Selektion.
- **Saved Views** (`where`-Preset) → Filter-Buttons.
- **Field-Renderer** → ersetzt die Default-Komponente eines Field-Typs
  (z. B. TipTap für `richText`).

```bash
npm run cms plugins   # zeigt Collections/Routes/Hooks/Events + Admin-Erweiterungen
```
