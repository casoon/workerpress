<script lang="ts">
/**
 * API-Token-Verwaltung (M2-7). Listet ausgestellte Tokens, stellt neue aus
 * (Scopes wählbar) und widerruft sie. Der Klartext wird nur einmal nach dem
 * Ausstellen angezeigt — danach existiert nur noch der Hash.
 */
import { onMount } from 'svelte';

type Token = {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: number | null;
  lastUsedAt: number | null;
};

const SCOPES = ['content:read', 'content:write', 'media:write', 'admin'] as const;
const ENDPOINT = '/api/internal/tokens';

let tokens = $state<Token[]>([]);
let name = $state('');
let selected = $state<string[]>(['content:read']);
let issued = $state<string | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);

async function refresh() {
  loading = true;
  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tokens = await res.json();
    error = null;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Laden fehlgeschlagen';
  } finally {
    loading = false;
  }
}

function toggleScope(scope: string) {
  selected = selected.includes(scope)
    ? selected.filter((s) => s !== scope)
    : [...selected, scope];
}

async function submit(event: SubmitEvent) {
  event.preventDefault();
  if (!name.trim() || selected.length === 0) return;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, scopes: selected }),
  });
  if (!res.ok) {
    error = `Ausstellen fehlgeschlagen (HTTP ${res.status})`;
    return;
  }
  const data = (await res.json()) as { token: string };
  issued = data.token;
  name = '';
  await refresh();
}

async function revoke(id: string) {
  await fetch(`${ENDPOINT}/${id}`, { method: 'DELETE' });
  await refresh();
}

onMount(refresh);
</script>

<section>
  <form onsubmit={submit}>
    <input placeholder="Token-Name (z. B. CI)" bind:value={name} required />
    <fieldset>
      <legend>Scopes</legend>
      {#each SCOPES as scope (scope)}
        <label>
          <input
            type="checkbox"
            checked={selected.includes(scope)}
            onchange={() => toggleScope(scope)}
          />
          {scope}
        </label>
      {/each}
    </fieldset>
    <button type="submit">Token ausstellen</button>
  </form>

  {#if issued}
    <p role="status">
      <strong>Neues Token (nur jetzt sichtbar):</strong>
      <code>{issued}</code>
    </p>
  {/if}

  {#if loading}
    <p>Lädt…</p>
  {:else if error}
    <p role="alert">Fehler: {error}</p>
  {:else if tokens.length === 0}
    <p>Noch keine Tokens.</p>
  {:else}
    <table>
      <thead>
        <tr><th>Name</th><th>Scopes</th><th>Zuletzt genutzt</th><th></th></tr>
      </thead>
      <tbody>
        {#each tokens as token (token.id)}
          <tr>
            <td>{token.name}</td>
            <td>{token.scopes.join(', ')}</td>
            <td>{token.lastUsedAt ? new Date(token.lastUsedAt * 1000).toLocaleString() : '—'}</td>
            <td><button type="button" onclick={() => revoke(token.id)}>Widerrufen</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>
