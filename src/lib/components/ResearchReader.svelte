<script lang="ts">
  import { researchSections } from '$lib/research-reader';
  import { renderMarkdown } from '$lib/domain';
  let { text = '' }: { text?: string } = $props();
  const content = $derived(researchSections(text));
  let container: HTMLDivElement;
  function expand(open: boolean) {
    container.querySelectorAll('details').forEach((element) => (element.open = open));
  }
  function jump(index: number) {
    const section = container.querySelectorAll('details')[index];
    if (!section) return;
    section.open = true;
    section.querySelector('summary')?.focus({ preventScroll: true });
    section.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
</script>

<div class="research-reader" bind:this={container}>
  {#if content.sections.length > 1}
    <nav aria-label="Indice delle sezioni">
      <label
        >Vai alla fonte / sezione
        <select
          onchange={(event) => {
            jump(Number(event.currentTarget.value));
            event.currentTarget.value = '';
          }}
        >
          <option value="">Scegli tra {content.sections.length} sezioni</option>
          {#each content.sections as section, index}<option value={index}>{section.title}</option
            >{/each}
        </select>
      </label>
      <div class="actions">
        <button onclick={() => expand(true)}>Apri tutto</button>
        <button onclick={() => expand(false)}>Chiudi tutto</button>
      </div>
    </nav>
  {/if}
  {#if content.intro.trim()}<div class="markdown">
      {@html renderMarkdown(content.intro, true)}
    </div>{/if}
  {#each content.sections as section, index}
    <details open={index === 0}>
      <summary>{section.title}</summary>
      <div class="markdown">{@html renderMarkdown(section.text, true)}</div>
    </details>
  {/each}
</div>

<style>
  .research-reader {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  nav {
    padding: 0.75rem 0;
  }
  label {
    display: grid;
    gap: 0.5rem;
  }
  select {
    width: 100%;
    min-width: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  details {
    border: 1px solid var(--line);
    border-radius: 8px;
    margin: 0.75rem 0;
  }
  summary {
    padding: 0.75rem;
    cursor: pointer;
    font-weight: 600;
    min-height: 44px;
    box-sizing: border-box;
  }
  .markdown {
    padding: 0 0.75rem;
  }
  .markdown :global(pre) {
    overflow-x: auto;
  }
</style>
