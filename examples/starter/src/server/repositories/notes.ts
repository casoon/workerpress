import type { DrizzleDatabase } from '@workerpress/core';
import { eq } from 'drizzle-orm';
import { type NewNote, type Note, notes } from '../db/schema.js';

/** Datenzugriff für `notes`. Einzige Schicht mit Drizzle-Queries. */
export interface NotesRepository {
  list(): Promise<Note[]>;
  get(id: string): Promise<Note | null>;
  create(note: NewNote): Promise<Note>;
  update(id: string, patch: Partial<Pick<Note, 'title' | 'body'>>): Promise<Note | null>;
  remove(id: string): Promise<boolean>;
}

export function notesRepository(db: DrizzleDatabase): NotesRepository {
  return {
    list() {
      return db.select().from(notes);
    },
    async get(id) {
      const rows = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
      return rows[0] ?? null;
    },
    async create(note) {
      const rows = await db.insert(notes).values(note).returning();
      return rows[0];
    },
    async update(id, patch) {
      const rows = await db.update(notes).set(patch).where(eq(notes.id, id)).returning();
      return rows[0] ?? null;
    },
    async remove(id) {
      const rows = await db.delete(notes).where(eq(notes.id, id)).returning();
      return rows.length > 0;
    },
  };
}
