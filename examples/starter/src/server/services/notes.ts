import type { DrizzleDatabase } from '@workerpress/core';
import type { Note } from '../db/schema.js';
import { notesRepository } from '../repositories/notes.js';

export interface CreateNoteInput {
  title: string;
  body?: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
}

/** Anwendungslogik für `notes` (IDs, Defaults). Kennt keine Drizzle-Details. */
export function notesService(db: DrizzleDatabase) {
  const repo = notesRepository(db);
  return {
    list: (): Promise<Note[]> => repo.list(),
    get: (id: string): Promise<Note | null> => repo.get(id),
    create: (input: CreateNoteInput): Promise<Note> =>
      repo.create({ id: crypto.randomUUID(), title: input.title, body: input.body ?? '' }),
    update: (id: string, input: UpdateNoteInput): Promise<Note | null> => repo.update(id, input),
    remove: (id: string): Promise<boolean> => repo.remove(id),
  };
}
