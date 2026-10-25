<script lang="ts">
  import { page } from '$app/state';
  import ActionHelp from './ActionHelp.svelte';
  import { backofficeActions } from '$lib/backoffice-navigation';
</script>

<div class="workspace-toolbar">
  <div>
    <h1>Prepariamo le interviste.</h1>
    <p>Ricerca condivisa · preparazione entro il 27 ottobre</p>
  </div>
  <div class="toolbar-actions" role="group" aria-label="Azioni rapide">
    {#each backofficeActions.slice(0, 1) as action}<div class="tool-action">
        <a
          class="button-link action-button"
          href={action.href}
          aria-current={page.url.pathname === action.href ? 'page' : undefined}>{action.label}</a
        >
        <ActionHelp title={action.label} description={action.description} />
      </div>{/each}
  </div>
</div>

<style>
  .workspace-toolbar {
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 1rem;
  }
  .tool-action {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }
</style>
