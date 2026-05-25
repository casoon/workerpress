import { zValidator } from '@hono/zod-validator';
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

/**
 * Thin CRUD routes for `notes`. Delegates to the service — no DB query here.
 * zValidator gives both runtime validation and request types for the hc client.
 */
export const notesRoutes = new Hono<Env>()
  .get('/', async (c) => {
    return c.json(await notesService(c.var.platform.db).list());
  })
  .get('/:id', async (c) => {
    const note = await notesService(c.var.platform.db).get(c.req.param('id'));
    return note ? c.json(note) : c.json({ error: 'not found' }, 404);
  })
  .post('/', zValidator('json', createSchema), async (c) => {
    return c.json(await notesService(c.var.platform.db).create(c.req.valid('json')), 201);
  })
  .put('/:id', zValidator('json', updateSchema), async (c) => {
    const note = await notesService(c.var.platform.db).update(
      c.req.param('id'),
      c.req.valid('json'),
    );
    return note ? c.json(note) : c.json({ error: 'not found' }, 404);
  })
  .delete('/:id', async (c) => {
    const ok = await notesService(c.var.platform.db).remove(c.req.param('id'));
    return ok ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
  });
