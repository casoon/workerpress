import { expect, test } from '@playwright/test';

/** Scaffold-Smoke (M3-3): Startseite lädt, /admin ist erreichbar. */
test('home page renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('admin is reachable (dev session)', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
});
