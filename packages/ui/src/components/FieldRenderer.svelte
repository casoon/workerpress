<script lang="ts">
import type { AdminField } from '@workerpress/core';
import MediaUpload from './MediaUpload.svelte';

interface Props {
  field: AdminField;
  value: unknown;
  onchange: (val: unknown) => void;
  disabled?: boolean;
}

let { field, value, onchange, disabled = false }: Props = $props();

function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function asNumber(v: unknown): number | '' {
  if (v == null || v === '') return '';
  return Number(v);
}

function asBoolean(v: unknown): boolean {
  return Boolean(v);
}
</script>

{#if field.kind === 'text' || field.kind === 'slug' || field.kind === 'email' || field.kind === 'url'}
  <input
    type={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : 'text'}
    id={field.name}
    name={field.name}
    value={asString(value)}
    required={field.required}
    maxlength={field.options.max}
    {disabled}
    oninput={(e) => onchange((e.target as HTMLInputElement).value)}
  />
{:else if field.kind === 'number'}
  <input
    type="number"
    id={field.name}
    name={field.name}
    value={asNumber(value)}
    required={field.required}
    {disabled}
    oninput={(e) => {
      const v = (e.target as HTMLInputElement).value;
      onchange(v === '' ? null : Number(v));
    }}
  />
{:else if field.kind === 'boolean'}
  <input
    type="checkbox"
    id={field.name}
    name={field.name}
    checked={asBoolean(value)}
    {disabled}
    onchange={(e) => onchange((e.target as HTMLInputElement).checked)}
  />
{:else if field.kind === 'date'}
  <input
    type="date"
    id={field.name}
    name={field.name}
    value={asString(value).slice(0, 10)}
    required={field.required}
    {disabled}
    oninput={(e) => onchange((e.target as HTMLInputElement).value || null)}
  />
{:else if field.kind === 'enum' && field.options.values}
  <select
    id={field.name}
    name={field.name}
    required={field.required}
    {disabled}
    onchange={(e) => onchange((e.target as HTMLSelectElement).value)}
  >
    {#if !field.required}
      <option value="">—</option>
    {/if}
    {#each field.options.values as opt}
      <option value={opt} selected={value === opt}>{opt}</option>
    {/each}
  </select>
{:else if field.kind === 'richText' || field.kind === 'markdown'}
  <textarea
    id={field.name}
    name={field.name}
    required={field.required}
    rows={6}
    {disabled}
    oninput={(e) => onchange((e.target as HTMLTextAreaElement).value)}
  >{asString(typeof value === 'object' && value !== null ? JSON.stringify(value) : value)}</textarea>
{:else if field.kind === 'media'}
  <MediaUpload
    value={typeof value === 'object' && value !== null ? value as {url: string; width?: number; height?: number} : null}
    accept={field.options.accept}
    onchange={(v) => onchange(v)}
    {disabled}
  />
{:else}
  <!-- Fallback: json/relation/array als text -->
  <input
    type="text"
    id={field.name}
    name={field.name}
    value={typeof value === 'object' && value !== null ? JSON.stringify(value) : asString(value)}
    {disabled}
    oninput={(e) => {
      try { onchange(JSON.parse((e.target as HTMLInputElement).value)); }
      catch { onchange((e.target as HTMLInputElement).value); }
    }}
  />
{/if}
