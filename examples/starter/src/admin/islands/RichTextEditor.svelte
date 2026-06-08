<script lang="ts">
/**
 * Default-Renderer für `richText`-Felder (M3-4) — eine eigenständige Svelte-Insel
 * ohne CDN-/externe Abhängigkeit (contenteditable + execCommand für Basis-
 * Formatierung). Plugins können diesen Renderer über den `fieldRenderers`-
 * Erweiterungspunkt durch z. B. einen TipTap-Editor ersetzen.
 */
let { value = $bindable(''), placeholder = 'Text…' }: { value?: string; placeholder?: string } =
  $props();

let el = $state<HTMLDivElement | null>(null);

function exec(command: string) {
  document.execCommand(command, false);
  if (el) value = el.innerHTML;
}

function onInput() {
  if (el) value = el.innerHTML;
}
</script>

<div class="rte">
  <div class="rte-toolbar" role="toolbar" aria-label="Formatierung">
    <button type="button" onclick={() => exec('bold')} aria-label="Fett"><strong>B</strong></button>
    <button type="button" onclick={() => exec('italic')} aria-label="Kursiv"><em>I</em></button>
    <button type="button" onclick={() => exec('insertUnorderedList')} aria-label="Liste">• List</button>
  </div>
  <div
    bind:this={el}
    class="rte-area"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    data-placeholder={placeholder}
    oninput={onInput}
  >{@html value}</div>
</div>

<style>
  .rte-toolbar { display: flex; gap: 0.25rem; margin-bottom: 0.25rem; }
  .rte-area {
    min-height: 6rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.5rem;
  }
  .rte-area:empty::before { content: attr(data-placeholder); color: #999; }
</style>
