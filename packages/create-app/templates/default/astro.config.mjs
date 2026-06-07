// @ts-check
import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';
import { defineConfig } from 'astro';

// Astro besitzt das UI, Hono besitzt /api/* — eine Worker (ARCHITECTURE §2).
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [svelte()],
});
