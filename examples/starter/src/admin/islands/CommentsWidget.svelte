<script lang="ts">
/**
 * Dashboard-Widget des comments-Plugins (M3-4). Zeigt die neuesten Kommentare.
 * Wird über `admin.widgets` registriert und vom Admin-Dashboard eingebettet.
 */
import { onMount } from 'svelte';

type Comment = { id: string; author: string; body: string; status: string };

let comments = $state<Comment[]>([]);
let loading = $state(true);

onMount(async () => {
  try {
    const res = await fetch('/api/internal/content/comments?orderBy=-createdAt&limit=5');
    if (res.ok) comments = await res.json();
  } finally {
    loading = false;
  }
});
</script>

<section class="widget">
  <h3>Neueste Kommentare</h3>
  {#if loading}
    <p>Lädt…</p>
  {:else if comments.length === 0}
    <p>Keine Kommentare.</p>
  {:else}
    <ul>
      {#each comments as c (c.id)}
        <li><strong>{c.author}</strong> ({c.status}): {c.body}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .widget { border: 1px solid #e2e2e2; border-radius: 6px; padding: 0.75rem 1rem; }
</style>
