<script lang="ts">
  import ActionHelp from './ActionHelp.svelte';
  type Action = {
    label: string;
    helpTitle?: string;
    description: string;
    onclick: () => void;
    disabled?: boolean;
  };
  let {
    primary,
    groups
  }: {
    primary: Action[];
    groups: { title: string; actions: Action[] }[];
  } = $props();
</script>

{#snippet action(item: Action)}
  <div class="tool-action">
    <button type="button" class="action-button" disabled={item.disabled} onclick={item.onclick}
      >{item.label}</button
    >
    <ActionHelp title={item.helpTitle || item.label} description={item.description} />
  </div>
{/snippet}

<div class="workspace-toolbar">
  <div>
    <h1>Prepariamo le interviste.</h1>
    <p>Ricerca condivisa · preparazione entro il 27 ottobre</p>
  </div>
  <div class="toolbar-actions" role="group" aria-label="Azioni rapide">
    {#each primary as item}{@render action(item)}{/each}
  </div>
</div>
<details class="backoffice-tools">
  <summary
    ><strong>Strumenti</strong><span>Importazioni, esportazioni e gestione del workspace</span
    ></summary
  >
  <div class="tool-groups">
    {#each groups as group}
      <section aria-label={group.title}>
        <h2>{group.title}</h2>
        {#each group.actions as item}{@render action(item)}{/each}
      </section>
    {/each}
  </div>
</details>

<style>
  .workspace-toolbar {
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  .toolbar-actions {
    flex-shrink: 0;
  }
  .tool-action {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    min-width: 0;
  }
  .action-button {
    min-height: 44px;
    text-align: left;
  }
  .backoffice-tools {
    margin-bottom: 1.5rem;
    border-block: 1px solid var(--line);
  }
  summary {
    padding: 0.85rem 0;
    cursor: pointer;
  }
  summary span {
    margin-left: 0.8rem;
    color: var(--muted);
    font-size: 0.9rem;
  }
  .tool-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(245px, 1fr));
    gap: 1.5rem;
    padding: 0.25rem 0 1.25rem;
  }
  h2 {
    font-size: 1rem;
    margin: 0 0 0.75rem;
  }
  section .tool-action {
    margin-bottom: 0.5rem;
  }
  section .action-button {
    flex: 1;
    font-weight: 500;
  }
  @media (max-width: 1000px) {
    .workspace-toolbar {
      flex-wrap: wrap;
    }
  }
  @media (max-width: 650px) {
    .toolbar-actions {
      gap: 0.4rem;
    }
    .tool-groups {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
    }
    summary span {
      display: block;
      margin: 0.15rem 0 0;
    }
  }
</style>
