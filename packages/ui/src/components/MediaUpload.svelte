<script lang="ts">
interface MediaValue {
  url: string;
  width?: number;
  height?: number;
}

interface Props {
  value: MediaValue | null;
  accept?: string;
  uploadUrl?: string;
  onchange: (val: MediaValue | null) => void;
  disabled?: boolean;
}

let { value, accept = 'image/*', uploadUrl = '/api/internal/media', onchange, disabled = false }: Props = $props();

let uploading = $state(false);
let uploadError = $state<string | null>(null);

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

async function handleFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  uploading = true;
  uploadError = null;

  try {
    let dims = { width: 0, height: 0 };
    if (file.type.startsWith('image/')) dims = await getImageDimensions(file);

    const form = new FormData();
    form.append('file', file);
    form.append('width', String(dims.width));
    form.append('height', String(dims.height));

    const res = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload fehlgeschlagen (${res.status})`);
    const data = (await res.json()) as MediaValue;
    onchange(data);
  } catch (err) {
    uploadError = err instanceof Error ? err.message : 'Upload fehlgeschlagen';
  } finally {
    uploading = false;
    input.value = '';
  }
}

function remove() { onchange(null); }
</script>

<div class="media-upload">
  {#if value?.url}
    <div class="preview">
      <img src={value.url} alt="Vorschau" />
      <div class="meta">
        {#if value.width && value.height}
          <span>{value.width} × {value.height}</span>
        {/if}
        <button type="button" onclick={remove} {disabled}>Entfernen</button>
      </div>
    </div>
  {:else}
    <label class="dropzone">
      {uploading ? 'Lädt hoch…' : 'Datei auswählen'}
      <input type="file" {accept} {disabled} onchange={handleFile} hidden />
    </label>
  {/if}
  {#if uploadError}
    <p role="alert" class="error">{uploadError}</p>
  {/if}
</div>

<style>
  .media-upload { display: flex; flex-direction: column; gap: 0.5rem; }
  .dropzone {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0.5rem 1rem; border: 2px dashed #ccc; border-radius: 4px;
    cursor: pointer; font-size: 0.875rem;
  }
  .dropzone:hover { border-color: #0070f3; }
  .preview { display: flex; flex-direction: column; gap: 0.5rem; max-width: 200px; }
  .preview img { max-width: 100%; border-radius: 4px; }
  .meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #666; }
  .error { color: red; font-size: 0.75rem; margin: 0; }
</style>
