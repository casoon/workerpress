import { hc } from 'hono/client';
import type { AppType } from '../../server/app.js';

/** Typsicherer RPC-Client — kennt jede Route über AppType (siehe ARCHITECTURE §8). */
export const api = hc<AppType>('/');

const notes = api.api.internal.notes;

/** Response- und Request-Typen fließen aus AppType — kein handgeschriebenes DTO. */
export async function listNotes() {
  const res = await notes.$get();
  return res.json();
}

export async function createNote(input: { title: string; body?: string }) {
  const res = await notes.$post({ json: input });
  if (!res.ok) throw new Error('Konnte Note nicht anlegen');
  return res.json();
}
