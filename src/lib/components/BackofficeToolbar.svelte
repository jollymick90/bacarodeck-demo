<script lang="ts">
  import { page } from '$app/state';
  import ActionHelp from './ActionHelp.svelte';
  import { backofficeActions } from '$lib/backoffice-navigation';
  const activeTab = $derived(
    page.url.pathname.startsWith('/backoffice/programmazione')
      ? 'programmazione'
      : /^\/backoffice\/(strumenti|importa|esporta|backup|tag|accessi)(\/|$)/.test(
            page.url.pathname
          )
        ? 'strumenti'
        : 'speaker'
  );
  const tabs = [
    { id: 'speaker', label: 'Speaker', href: '/backoffice' },
    { id: 'programmazione', label: 'Programmazione', href: '/backoffice/programmazione' },
    { id: 'strumenti', label: 'Strumenti', href: '/backoffice/strumenti' }
  ];
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
<nav class="backoffice-navigation" aria-label="Gestione">
  {#each tabs as tab}<a href={tab.href} aria-current={activeTab === tab.id ? 'page' : undefined}
      >{tab.label}</a
    >{/each}
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-bottom: 1px solid var(--line);
    margin-bottom: 1.5rem;
  }
  .backoffice-navigation a {
    padding: 0.75rem 0.25rem;
    text-align: center;
    text-decoration: none;
    border-bottom: 3px solid transparent;
    color: var(--muted);
    font-size: 0.9rem;
    min-height: 48px;
  }
  .backoffice-navigation a[aria-current='page'] {
    color: var(--blue);
    border-color: var(--blue);
    font-weight: 700;
  }
</style>
