import { definePolicy } from '@workerpress/core';

interface User {
  id: string;
  role?: 'admin' | 'editor' | 'viewer';
}

interface BlogDoc {
  author?: string;
  status?: 'draft' | 'published';
}

export const isAuthenticated = definePolicy<BlogDoc, User>(
  'isAuthenticated',
  ({ user }) => !!user,
);

export const isEditor = definePolicy<BlogDoc, User>(
  'isEditor',
  ({ user }) => user?.role === 'editor' || user?.role === 'admin',
);

export const isPublished = definePolicy<BlogDoc, User>(
  'isPublished',
  ({ doc }) => doc?.status === 'published',
);

export const ownsDocument = definePolicy<BlogDoc, User>(
  'ownsDocument',
  ({ user, doc }) => !!user && doc?.author === user.id,
);
