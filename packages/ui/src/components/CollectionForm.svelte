<script lang="ts">
import type { AdminCollectionSchema } from '@workerpress/core';
import FieldRenderer from './FieldRenderer.svelte';

interface Props {
  schema: AdminCollectionSchema;
  recordId?: string;
  /** Redirect-URL nach erfolgreichem Speichern */
  listUrl?: string;
}

let { schema, recordId, listUrl }: Props = $props();

type Row = Record<string, unknown>;

let values = $state<Row>({});
let errors = $state<Record<string, string>>({});
let saving = $state(false);
let globalError = $state<string | null>(null);
let loaded = $state(false);

const isEdit = Boolean(recordId);

async function load() {
  if (!recordId) { loaded = true; return; }
  try {
    const res = await fetch(`${schema.apiBase}/${recordId}`);
    if (!res.ok) throw new Error(`Laden fehlgeschlagen (${res.status})`);
    values = (await res.json()) as Row;
  } catch (e) {
    globalError = e instanceof Error ? e.message : 'Unbekannter Fehler';
  } finally {
    loaded = true;
  }
}

async function submit(e: SubmitEvent) {
  e.preventDefault();
  saving = true;
  errors = {};
  globalError = null;

  const url = isEdit ? `${schema.apiBase}/${recordId}` : schema.apiBase;
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      if (listUrl) location.href = listUrl;
    } else {
      const body = (await res.json()) as { error?: unknown; policy?: string };
      if (body.policy) {
        globalError = `Zugriff verweigert (Policy: ${body.policy})`;
      } else if (typeof body.error === 'object' && body.error !== null) {
        const flat = body.error as { fieldErrors?: Record<string, string[]> };
        for (const [k, msgs] of Object.entries(flat.fieldErrors ?? {})) {
          errors[k] = Array.isArray(msgs) ? msgs[0] ?? '' : String(msgs);
        }
      } else {
        globalError = String(body.error ?? 'Unbekannter Fehler');
      }
    }
  } catch (err) {
    globalError = err instanceof Error ? err.message : 'Netzwerkfehler';
  } finally {
    saving = false;
  }
}

async function deleteRecord() {
  if (!recordId) return;
  if (!confirm(`${schema.singular} wirklich löschen?`)) return;
  try {
    const res = await fetch(`${schema.apiBase}/${recordId}`, { method: 'DELETE' });
    if (res.ok && listUrl) location.href = listUrl;
    else globalError = `Löschen fehlgeschlagen (${res.status})`;
  } catch (err) {
    globalError = err instanceof Error ? err.message : 'Netzwerkfehler';
  }
}

// Lade vorhandenen Datensatz beim Mounten
$effect(() => { void load(); });
</script>

{#if !loaded}
  <p>Lädt…</p>
{:else}
  {#if globalError}
    <p role="alert" style="color: red">{globalError}</p>
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

<style>
  .field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 1rem; }
  label { font-weight: 500; font-size: 0.875rem; }
  .error { color: red; font-size: 0.75rem; }
  .actions { display: flex; gap: 1rem; align-items: center; margin-top: 1.5rem; }
</style>
