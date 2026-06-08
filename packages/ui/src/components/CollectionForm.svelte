<script lang="ts">
import type { AdminCollectionSchema } from '@workerpress/core';
import FieldRenderer from './FieldRenderer.svelte';
import { createQuery, createMutation, QueryClientProvider } from '@tanstack/svelte-query';
import { queryClient } from '../queryClient.js';

interface Props {
  schema: AdminCollectionSchema;
  recordId?: string;
  /** Redirect-URL nach erfolgreichem Speichern */
  listUrl?: string;
}

let { schema, recordId, listUrl }: Props = $props();

type Row = Record<string, unknown>;

const isEdit = Boolean(recordId);
let errors = $state<Record<string, string>>({});
let globalError = $state<string | null>(null);

// Query to load data (only if isEdit is true)
const query = createQuery(() => ({
  queryKey: ['collection-record', schema.name, recordId],
  queryFn: async () => {
    const res = await fetch(`${schema.apiBase}/${recordId}`);
    if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
    return (await res.json()) as Row;
  },
  enabled: isEdit,
}), queryClient);

// Local values state initialized when data is loaded
let values = $state<Row>({});
$effect(() => {
  if (query.data) {
    values = { ...query.data };
  }
});

// Mutation to save data (POST or PUT)
const saveMutation = createMutation(() => ({
  mutationFn: async (data: Row) => {
    const url = isEdit ? `${schema.apiBase}/${recordId}` : schema.apiBase;
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw body;
    }
    return res.headers.get('content-type')?.includes('application/json')
      ? await res.json().catch(() => ({}))
      : {};
  },
  onSuccess: () => {
    // Invalidate the collection cache to force refetching in list view
    void queryClient.invalidateQueries({ queryKey: ['collection', schema.name] });
    if (listUrl) location.href = listUrl;
  },
  onError: (err: any) => {
    if (err && typeof err === 'object') {
      if (err.policy) {
        globalError = `Zugriff verweigert (Policy: ${err.policy})`;
      } else if (err.error && typeof err.error === 'object') {
        const flat = err.error as { fieldErrors?: Record<string, string[]> };
        for (const [k, msgs] of Object.entries(flat.fieldErrors ?? {})) {
          errors[k] = Array.isArray(msgs) ? msgs[0] ?? '' : String(msgs);
        }
      } else {
        globalError = String(err.error ?? 'Unbekannter Fehler');
      }
    } else {
      globalError = err instanceof Error ? err.message : 'Netzwerkfehler';
    }
  }
}), queryClient);

// Mutation to delete data
const deleteMutation = createMutation(() => ({
  mutationFn: async () => {
    const res = await fetch(`${schema.apiBase}/${recordId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Löschen fehlgeschlagen (${res.status})`);
  },
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['collection', schema.name] });
    if (listUrl) location.href = listUrl;
  },
  onError: (err: any) => {
    globalError = err instanceof Error ? err.message : 'Netzwerkfehler';
  }
}), queryClient);

async function submit(e: SubmitEvent) {
  e.preventDefault();
  errors = {};
  globalError = null;
  saveMutation.mutate(values);
}

async function deleteRecord() {
  if (!recordId) return;
  if (!confirm(`${schema.singular} wirklich löschen?`)) return;
  deleteMutation.mutate();
}

const saving = $derived(saveMutation.isPending || deleteMutation.isPending);
const loaded = $derived(!isEdit || query.isSuccess);
</script>

<QueryClientProvider client={queryClient}>
  {#if !loaded}
    <p>Lädt…</p>
  {:else}
    {#if globalError}
      <p role="alert" style="color: red">{globalError}</p>
    {/if}
    {#if query.error}
      <p role="alert" style="color: red">{query.error.message}</p>
    {/if}

    <form onsubmit={submit}>
      {#each schema.fields as f (f.name)}
        {#if f.kind !== 'relation' && f.kind !== 'array' && f.kind !== 'group' && f.kind !== 'json'}
          <div class="field">
            <label for={f.name}>
              {f.label}{f.required ? ' *' : ''}
            </label>
            <FieldRenderer
              field={f}
              value={values[f.name]}
              onchange={(v) => { values = { ...values, [f.name]: v }; }}
              disabled={saving}
            />
            {#if errors[f.name]}
              <span class="error">{errors[f.name]}</span>
            {/if}
          </div>
        {/if}
      {/each}

      <div class="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Speichert…' : isEdit ? 'Speichern' : `${schema.singular} anlegen`}
        </button>
        {#if listUrl}
          <a href={listUrl}>Abbrechen</a>
        {/if}
        {#if isEdit}
          <button type="button" onclick={deleteRecord} disabled={saving} style="margin-left: auto; color: red">
            Löschen
          </button>
        {/if}
      </div>
    </form>
  {/if}
</QueryClientProvider>

<style>
  .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 1rem; }
  label { font-weight: 500; font-size: 0.875rem; }
  .error { color: red; font-size: 0.75rem; }
  .actions { display: flex; gap: 1rem; align-items: center; margin-top: 1.5rem; }
</style>
