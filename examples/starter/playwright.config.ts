import { defineConfig } from '@playwright/test';

/**
 * Playwright-Smoke gegen den lokalen Astro-Dev-Server (M3-5). Im Dev-Modus ist
 * eine Demo-Admin-Session aktiv, sodass /admin ohne echtes Access-JWT erreichbar ist.
 */
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4321' },
});
