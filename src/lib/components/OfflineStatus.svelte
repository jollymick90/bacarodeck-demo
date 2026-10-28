<script lang="ts">
  import { getWorkspace } from '$lib/workspace.svelte';
  import { offlineLifetime } from '$lib/offline/snapshot';
  import PasswordLogin from './PasswordLogin.svelte';
  const workspace = getWorkspace();
  const snapshot = $derived(workspace.offlineSnapshot);
  const count = $derived(
    snapshot ? Object.values(snapshot.data).reduce((n, items) => n + (items?.length || 0), 0) : 0
  );
  const date = (value: number) =>
    new Date(value).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Rome'
    });
</script>

<aside class="offline-status" aria-label="Dati offline">
  {#if workspace.readOnly}
    <p class="warning" role="status">
      <strong>{workspace.online ? 'Consultazione in sola lettura' : 'Consultazione offline'}</strong
      > · Le modifiche richiedono la connessione e la verifica dell’accesso.
    </p>
    {#if workspace.online}<button
        onclick={() => (workspace.user ? workspace.retryAccess() : workspace.login())}
      >
        {workspace.user ? 'Verifica accesso online' : 'Accedi con Google'}
      </button>{#if !workspace.user}<PasswordLogin />{/if}{/if}
  {/if}
  <details>
    <summary>Dati su questo dispositivo</summary>
    {#if snapshot}
      <p><strong>Pronto per l’evento</strong> · {count} contenuti salvati</p>
      <p>
        Contenuti aggiornati il {date(snapshot.downloadedAt)}<br />Accesso offline fino al {date(
          snapshot.verifiedAt + offlineLifetime
        )}
      </p>
    {:else}
      <p>Scarica speaker, talk, domande, scalette e note per riaprire l’app anche senza rete.</p>
    {/if}
    <button
      disabled={workspace.readOnly || workspace.preparing}
      onclick={() => workspace.prepareOffline()}
    >
      {workspace.preparing
        ? 'Preparazione in corso…'
        : snapshot
          ? 'Aggiorna adesso'
          : 'Prepara questo telefono per l’evento'}
    </button>
    {#if workspace.preparing}<p role="status">{workspace.progress}</p>{/if}
    {#if workspace.offlineError}<p class="error" role="alert">
        {workspace.offlineError}{snapshot ? ' La copia precedente è conservata.' : ''}
      </p>{/if}
    <p class="muted">
      Foto, siti e allegati esterni possono richiedere rete. Se il browser cancella i dati, occorre
      preparare nuovamente il dispositivo.
    </p>
    {#if workspace.persistentStorage === false}<p class="muted">
        Il browser non ha concesso la conservazione persistente.
      </p>{/if}
  </details>
</aside>

<style>
  .offline-status {
    margin-bottom: 1rem;
  }
  details {
    border: 1px solid var(--line);
    padding: 0.75rem;
    border-radius: 8px;
  }
  summary {
    cursor: pointer;
    font-weight: 600;
  }
  details p {
    font-size: 0.9rem;
  }
</style>
