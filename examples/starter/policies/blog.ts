import { type AuthUser, definePolicy } from '@workerpress/core';

interface BlogDoc {
  author?: string;
  status?: 'draft' | 'published';
}

export const isAuthenticated = definePolicy<BlogDoc, AuthUser>(
  'isAuthenticated',
  ({ user }) => !!user,
);

export const isEditor = definePolicy<BlogDoc, AuthUser>('isEditor', ({ user }) =>
  Boolean(user?.groups?.some((g) => g === 'editor' || g === 'admin')),
);

export const isPublished = definePolicy<BlogDoc, AuthUser>(
  'isPublished',
  ({ doc }) => doc?.status === 'published',
);

export const ownsDocument = definePolicy<BlogDoc, AuthUser>(
  'ownsDocument',
  ({ user, doc }) => !!user && doc?.author === user.id,
);
