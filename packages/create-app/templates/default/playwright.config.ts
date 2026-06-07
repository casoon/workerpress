import { defineConfig } from '@playwright/test';

/** Playwright-Smoke gegen den lokalen Astro-Dev-Server (M3-3/M3-5). */
export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4321' },
});
