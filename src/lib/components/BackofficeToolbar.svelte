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
    {#each backofficeActions.slice(0, 2) as action}<div class="tool-action">
        <a
          class="button-link action-button"
          href={action.href}
          aria-current={page.url.pathname === action.href ? 'page' : undefined}>{action.label}</a
        >
        <ActionHelp title={action.label} description={action.description} />
      </div>{/each}
  </div>
</div>
<nav class="backoffice-navigation" aria-label="Backoffice">
  <a href="/backoffice" aria-current={page.url.pathname === '/backoffice' ? 'page' : undefined}
    >Speaker</a
  >
  <a
    href="/backoffice/strumenti"
    aria-current={page.url.pathname === '/backoffice/strumenti' ? 'page' : undefined}>Strumenti</a
  >
  <a href="/">← Vista conduttore</a>
</nav>

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
  .backoffice-navigation {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    border-bottom: 1px solid var(--line);
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
  }
  [aria-current='page'] {
    font-weight: 700;
  }
</style>
