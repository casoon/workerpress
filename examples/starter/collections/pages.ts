import { anyOf, defineCollection, field } from '@workerpress/core';
import { isAuthenticated, isEditor, isPublished } from '../policies/blog.js';

export default defineCollection({
  name: 'pages',
  version: 1,
  labels: { singular: 'Seite', plural: 'Seiten' },
  fields: {
    title: field.text({ required: true, max: 200 }),
    slug: field.slug({ from: 'title', unique: true, indexed: true }),
    body: field.richText({ searchable: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    // Multi-Site: Hauptseite vs. Landingpage; NULL = global (ARCHITECTURE §13).
    site: field.relation({ to: 'sites', indexed: true }),
  },
  access: {
    read: anyOf(isPublished, isAuthenticated),
    write: isEditor,
  },
  revalidate: [({ doc }) => `/${doc.slug}`],
});
