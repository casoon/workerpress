/**
 * Media-Upload-Route (M1-11). Nimmt Multipart-Daten entgegen, speichert in R2
 * über platform.storage und legt Metadaten in der `media`-Tabelle ab.
 * Gibt { id, url, width, height } zurück.
 */

import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthUser, Platform } from '@workerpress/core';

type Env = { Bindings: Cloudflare.Env; Variables: { platform: Platform; user?: AuthUser } };

export const mediaRoutes = new Hono<Env>().post('/', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'multipart/form-data erwartet' }, 400);

  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ error: 'Kein file-Feld' }, 400);

  const width = Number(form.get('width') ?? 0);
  const height = Number(form.get('height') ?? 0);

  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop() ?? 'bin';
  const key = `media/${id}.${ext}`;

  const platform = c.var.platform;

  await platform.storage.put(key, await file.arrayBuffer());

  const url = platform.storage.url(key);

  await platform.db.run(
    sql`INSERT INTO "media" ("id","key","url","mimeType","width","height")
        VALUES (${id}, ${key}, ${url}, ${file.type}, ${width}, ${height})`,
  );

  return c.json({ id, url, width, height }, 201);
});
