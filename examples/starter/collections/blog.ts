import { allOf, anyOf, defineCollection, field } from '@workerpress/core';
import { isAuthenticated, isEditor, isPublished, ownsDocument } from '../policies/blog.js';

export default defineCollection({
  name: 'blog',
  version: 1,
  labels: { singular: 'Beitrag', plural: 'Beiträge' },
  fields: {
    title: field.text({ required: true, max: 200 }),
    slug: field.slug({ from: 'title', unique: true, indexed: true }),
    body: field.richText({ searchable: true }),
    cover: field.media({ accept: 'image/*' }),
    author: field.relation({ to: 'users' }),
    tags: field.relation({ to: 'tags', many: true }),
    publishedAt: field.date(),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
    // Multi-Site: optionale Zuordnung; NULL = global. Filter, keine Isolation (ARCHITECTURE §13).
    site: field.relation({ to: 'sites', indexed: true }),
  },
  access: {
    read: anyOf(isPublished, isAuthenticated),
    write: allOf(isEditor, ownsDocument),
  },
  hooks: {
    beforeChange: [
      ({ doc }) => {
        if (!doc.slug && typeof doc.title === 'string') {
          doc.slug = doc.title.toLowerCase().replace(/\s+/g, '-');
        }
      },
    ],
  },
  revalidate: ['/blog', ({ doc }) => `/blog/${doc.slug}`],
});
