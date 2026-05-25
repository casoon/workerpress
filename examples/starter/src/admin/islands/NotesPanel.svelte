<script lang="ts">
import { onMount } from 'svelte';
import { createNote, listNotes } from '../lib/api';

type Notes = Awaited<ReturnType<typeof listNotes>>;

let notes = $state<Notes>([]);
let title = $state('');
let body = $state('');
let loading = $state(true);
let error = $state<string | null>(null);

async function refresh() {
  loading = true;
  try {
    notes = await listNotes();
    error = null;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Laden fehlgeschlagen';
  } finally {
    loading = false;
  }
}

async function submit(event: SubmitEvent) {
  event.preventDefault();
  if (!title.trim()) return;
  await createNote({ title, body: body || undefined });
  title = '';
  body = '';
  await refresh();
}

onMount(refresh);
</script>

<section>
  <form onsubmit={submit}>
    <input placeholder="Titel" bind:value={title} required />
    <input placeholder="Text" bind:value={body} />
    <button type="submit">Anlegen</button>
  </form>

  {#if loading}
    <p>Lädt…</p>
  {:else if error}
    <p role="alert">Fehler: {error}</p>
  {:else if notes.length === 0}
    <p>Noch keine Notes.</p>
  {:else}
    <ul>
      {#each notes as note (note.id)}
        <li><strong>{note.title}</strong>{note.body ? ` — ${note.body}` : ''}</li>
      {/each}
    </ul>
  {/if}
</section>
