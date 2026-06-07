import { defineCollection, field } from '@workerpress/core';

export default defineCollection({
  name: 'blog',
  version: 1,
  labels: { singular: 'Beitrag', plural: 'Beiträge' },
  fields: {
    title: field.text({ required: true, max: 200 }),
    slug: field.slug({ from: 'title', unique: true, indexed: true }),
    body: field.richText({ searchable: true }),
    status: field.enum(['draft', 'published'], { default: 'draft', indexed: true }),
  },
  revalidate: ['/blog', ({ doc }) => `/blog/${doc.slug}`],
});
