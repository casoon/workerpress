import type { Platform } from '@workerpress/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { notesService } from '../../services/notes.js';

type Env = { Variables: { platform: Platform } };

const createSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
});

const updateSchema = z
  .object({ title: z.string().min(1).optional(), body: z.string().optional() })
  .refine((value) => value.title !== undefined || value.body !== undefined, {
    message: 'at least one of title or body is required',
  });

/** Thin CRUD routes for `notes`. Delegates to the service — no DB query here. */
export const notesRoutes = new Hono<Env>()
  .get('/', async (c) => {
    return c.json(await notesService(c.var.platform.db).list());
  })
  .get('/:id', async (c) => {
    const note = await notesService(c.var.platform.db).get(c.req.param('id'));
    return note ? c.json(note) : c.json({ error: 'not found' }, 404);
  })
  .post('/', async (c) => {
    const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(await notesService(c.var.platform.db).create(parsed.data), 201);
  })
  .put('/:id', async (c) => {
    const parsed = updateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const note = await notesService(c.var.platform.db).update(c.req.param('id'), parsed.data);
    return note ? c.json(note) : c.json({ error: 'not found' }, 404);
  })
  .delete('/:id', async (c) => {
    const ok = await notesService(c.var.platform.db).remove(c.req.param('id'));
    return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
  });
