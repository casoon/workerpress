<script lang="ts">
import type { AdminCollectionSchema } from '@workerpress/core';

interface Props {
  schema: AdminCollectionSchema;
  editUrlBase?: string;
  newUrl?: string;
}

let { schema, editUrlBase, newUrl }: Props = $props();

type Row = Record<string, unknown>;

let rows = $state<Row[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let orderBy = $state('id');
let order = $state<'asc' | 'desc'>('asc');
let offset = $state(0);
const limit = 20;
let hasMore = $state(false);

const displayFields = $derived(
  schema.fields.filter((f) =>
    ['text', 'slug', 'enum', 'number', 'boolean', 'date'].includes(f.kind),
  ).slice(0, 5),
);

async function load() {
  loading = true;
  error = null;
  try {
    const params = new URLSearchParams({
      limit: String(limit + 1),
      offset: String(offset),
      orderBy,
      order,
    });
    const res = await fetch(`${schema.apiBase}?${params}`);
    if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as Row[];
    hasMore = data.length > limit;
    rows = data.slice(0, limit);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unbekannter Fehler';
  } finally {
    loading = false;
  }
}

function sort(col: string) {
  if (orderBy === col) {
    order = order === 'asc' ? 'desc' : 'asc';
  } else {
    orderBy = col;
    order = 'asc';
  }
  offset = 0;
  void load();
}

function prev() { offset = Math.max(0, offset - limit); void load(); }
function next() { offset += limit; void load(); }

function cellText(row: Row, name: string): string {
  const v = row[name];
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
  return String(v);
}

$effect(() => { void load(); });
</script>

<div class="toolbar">
  <h2>{schema.plural}</h2>
  {#if newUrl}
    <a href={newUrl} class="btn-primary">{schema.singular} anlegen</a>
  {/if}
</div>

{#if loading}
  <p>Lädt…</p>
{:else if error}
  <p role="alert" style="color: red">{error}</p>
{:else if rows.length === 0}
  <p>Keine {schema.plural} vorhanden.</p>
{:else}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each displayFields as f}
            <th>
              <button type="button" onclick={() => sort(f.name)}>
                {f.label}
                {#if orderBy === f.name}{order === 'asc' ? ' ↑' : ' ↓'}{/if}
              </button>
            </th>
          {/each}
          {#if editUrlBase}<th></th>{/if}
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            {#each displayFields as f}
              <td>{cellText(row, f.name)}</td>
            {/each}
            {#if editUrlBase}
              <td><a href={`${editUrlBase}/${row.id}`}>Bearbeiten</a></td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="pagination">
    <button type="button" onclick={prev} disabled={offset === 0}>Zurück</button>
    <span>{offset + 1}–{offset + rows.length}</span>
    <button type="button" onclick={next} disabled={!hasMore}>Weiter</button>
  </div>
{/if}

<style>
  .toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .toolbar h2 { margin: 0; }
  .btn-primary { padding: 0.4rem 0.8rem; background: #0070f3; color: #fff; border-radius: 4px; text-decoration: none; font-size: 0.875rem; }
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
  th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
  th button { background: none; border: none; cursor: pointer; font-weight: 600; padding: 0; }
  .pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; font-size: 0.875rem; }
  .pagination button { padding: 0.3rem 0.7rem; cursor: pointer; }
  .pagination button:disabled { opacity: 0.4; cursor: default; }
</style>
