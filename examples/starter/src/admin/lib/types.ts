/**
 * Pro-Collection-Typen für Admin-UI und RPC (M1-6). Abgeleitet aus den
 * Collection-Definitionen, deckungsgleich mit den Zod-select/insert-Schemas.
 */

import type { InferInsert, InferSelect } from '@workerpress/core';

type BlogCollection = typeof import('../../../collections/blog.js').default;
type PagesCollection = typeof import('../../../collections/pages.js').default;

export type Blog = InferSelect<BlogCollection>;
export type NewBlog = InferInsert<BlogCollection>;
export type Page = InferSelect<PagesCollection>;
export type NewPage = InferInsert<PagesCollection>;
