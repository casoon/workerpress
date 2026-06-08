# Collections & Fields

Eine Collection ist die eine Quelle der Wahrheit. `defineCollection` beschreibt
Felder, Policies, Hooks und Revalidation; daraus werden alle Artefakte generiert.

```ts
import { defineCollection, field } from '@workerpress/core';

export default defineCollection({
  name: 'blog',
  version: 1,
  labels: { singular: 'Beitrag', plural: 'Beiträge' },
  fields: {
    title: field.text({ required: true, max: 200 }),
    slug: field.slug({ from: 'title', unique: true, indexed: true }),
    body: field.richText({ searchable: true }),
    author: field.relation({ to: 'users' }),
    tags: field.relation({ to: 'tags', many: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    site: field.relation({ to: 'sites', indexed: true }), // Multi-Site (optional)
  },
  revalidate: ['/blog', ({ doc }) => `/blog/${doc.slug}`],
});
```

## Field-Typen

`text`, `richText`, `markdown`, `number`, `boolean`, `date`, `enum`, `slug`,
`media`, `relation`, `json`, `email`, `url`.

Gemeinsame Optionen: `required`, `indexed`, `unique`, `searchable`, plus
typ-spezifische (`max`/`min`, `values`, `to`/`many`, `default`, `accept`, `from`).

## Hybrid-Schema (ARCHITECTURE §4/§5)

Stabile, skalare Felder werden eigene Spalten; flexible Felder leben in der
JSON-Spalte `data`. `indexed`/`unique` erzeugt Indizes (bei JSON-Feldern über
eine generierte Spalte). Einwertige Relationen sind Spalten, `many`-Relationen
ein JSON-Array.

## Sichtbar machen

```bash
npm run cms inspect blog          # Tabelle, Routen, Schemas, Policies, Forms, Suche, Migration
npm run cms inspect blog --json   # maschinenlesbar
```

## Relationen auflösen (M2-4)

```http
GET /api/content/blog?include=author,tags
```

Ein Batch-Query pro Relation (kein N+1); single → Objekt, many → Objekt-Array.
Tiefe auf 1 begrenzt. Typsicher über `WithInclude<typeof blog, { author: ... }>`.
