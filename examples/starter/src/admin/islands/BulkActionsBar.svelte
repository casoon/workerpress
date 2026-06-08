<script lang="ts">
/**
 * Bulk-Actions + Saved Views (M3-4). Lädt die Datensätze einer Collection, erlaubt
 * Mehrfachauswahl und wendet eine deklarative Bulk-Action (`set`) per Update auf
 * alle selektierten Zeilen an. Views setzen ein Filter-Preset (`where`).
 */
import { onMount } from 'svelte';

type Row = { id: string; [k: string]: unknown };
type BulkAction = { id: string; label: string; set?: Record<string, unknown> };
type View = { name: string; where: Record<string, unknown> };

let {
  collection,
  bulkActions = [],
  views = [],
}: { collection: string; bulkActions?: BulkAction[]; views?: View[] } = $props();

let rows = $state<Row[]>([]);
let selected = $state<Set<string>>(new Set());
let activeView = $state<string | null>(null);
let loading = $state(true);

const base = `/api/internal/content/${collection}`;

function viewQuery(where: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(where)) p.set(`where[${k}]`, String(v));
  return p.toString();
}

async function refresh() {
  loading = true;
  const view = views.find((v) => v.name === activeView);
  const qs = view ? `?${viewQuery(view.where)}` : '';
  const res = await fetch(`${base}${qs}`);
  rows = res.ok ? await res.json() : [];
  selected = new Set();
  loading = false;
}

function toggle(id: string) {
  const next = new Set(selected);
  next.has(id) ? next.delete(id) : next.add(id);
  selected = next;
}

async function apply(action: BulkAction) {
  if (!action.set || selected.size === 0) return;
  await Promise.all(
    [...selected].map((id) =>
      fetch(`${base}/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action.set),
      }),
    ),
  );
  await refresh();
}

function selectView(name: string | null) {
  activeView = name;
  refresh();
}

onMount(refresh);
</script>

<section>
  {#if views.length}
    <div class="views">
      <button type="button" class:active={activeView === null} onclick={() => selectView(null)}>
        Alle
      </button>
      {#each views as view (view.name)}
        <button
          type="button"
          class:active={activeView === view.name}
          onclick={() => selectView(view.name)}
        >
          {view.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if bulkActions.length}
    <div class="toolbar">
      <span>{selected.size} ausgewählt</span>
      {#each bulkActions as action (action.id)}
        <button type="button" disabled={selected.size === 0} onclick={() => apply(action)}>
          {action.label}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <p>Lädt…</p>
  {:else}
    <table>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            <td>
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onchange={() => toggle(row.id)}
              />
            </td>
            <td>{row.title ?? row.author ?? row.id}</td>
            <td>{row.status ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<style>
  .views, .toolbar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
  .views .active { font-weight: bold; }
</style>
