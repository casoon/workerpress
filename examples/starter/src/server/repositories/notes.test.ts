import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { beforeEach, describe, expect, it } from 'vitest';
import { notesRepository } from './notes.js';

function makeDb() {
  return drizzle(createClient({ url: ':memory:' }));
}

async function migrate(db: ReturnType<typeof makeDb>) {
  await db.run(sql`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}

describe('notesRepository', () => {
  let db: ReturnType<typeof makeDb>;

  beforeEach(async () => {
    db = makeDb();
    await migrate(db);
  });

  it('creates and reads a note', async () => {
    const repo = notesRepository(db);
    const created = await repo.create({ id: 'n1', title: 'Hello' });
    expect(created.title).toBe('Hello');
    expect(await repo.get('n1')).toMatchObject({ id: 'n1', title: 'Hello' });
  });

  it('lists all notes', async () => {
    const repo = notesRepository(db);
    await repo.create({ id: 'a', title: 'A' });
    await repo.create({ id: 'b', title: 'B' });
    expect(await repo.list()).toHaveLength(2);
  });

  it('updates a note', async () => {
    const repo = notesRepository(db);
    await repo.create({ id: 'n1', title: 'Old' });
    expect((await repo.update('n1', { title: 'New' }))?.title).toBe('New');
  });

  it('deletes a note', async () => {
    const repo = notesRepository(db);
    await repo.create({ id: 'n1', title: 'X' });
    expect(await repo.remove('n1')).toBe(true);
    expect(await repo.get('n1')).toBeNull();
  });

  it('reports missing notes', async () => {
    const repo = notesRepository(db);
    expect(await repo.get('nope')).toBeNull();
    expect(await repo.update('nope', { title: 'x' })).toBeNull();
    expect(await repo.remove('nope')).toBe(false);
  });
});
