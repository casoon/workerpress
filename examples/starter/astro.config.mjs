import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
  // /api/* is owned by Hono (+ better-auth) for auth/CSRF. Astro's page-level
  // origin check would 403 programmatic API clients (e.g. DELETE without Origin).
  security: { checkOrigin: false },
});
