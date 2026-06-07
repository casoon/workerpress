import { expect, test } from '@playwright/test';

/**
 * Admin-Flow-Smoke (M3-5). Die UI-Smokes prüfen Erreichbarkeit und Navigation;
 * der CRUD-Flow läuft über die Internal-API (create → edit → delete) und deckt
 * damit Validierung, Hooks, Versionierung und Cache-Revalidation mit ab.
 */

test('admin dashboard is reachable (dev session) and lists collections', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Beiträge' })).toBeVisible();
  // Verwaltungs-Links (M2-7/M2-9) und Plugin-Widget (M3-4).
  await expect(page.getByRole('link', { name: 'API-Tokens' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sites' })).toBeVisible();
});

test('blog CRUD via the internal API', async ({ request }) => {
  // Create
  const created = await request.post('/api/internal/content/blog', {
    data: { title: 'E2E Beitrag', status: 'draft' },
  });
  expect(created.status()).toBe(201);
  const { id, slug } = await created.json();
  expect(slug).toBe('e2e-beitrag'); // beforeChange-Hook leitet den Slug ab

  // Read
  const read = await request.get(`/api/internal/content/blog/${id}`);
  expect(read.status()).toBe(200);

  // Update → publish
  const updated = await request.put(`/api/internal/content/blog/${id}`, {
    data: { status: 'published' },
  });
  expect(updated.status()).toBe(200);

  // Version history exists (M2-6)
  const versions = await request.get(`/api/internal/content/blog/${id}/versions`);
  expect(versions.status()).toBe(200);
  expect((await versions.json()).length).toBeGreaterThanOrEqual(2);

  // Delete
  const removed = await request.delete(`/api/internal/content/blog/${id}`);
  expect(removed.status()).toBe(204);
  expect((await request.get(`/api/internal/content/blog/${id}`)).status()).toBe(404);
});
