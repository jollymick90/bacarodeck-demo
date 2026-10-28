<script lang="ts">
  import { api, assertWriteAccess, refreshWorkspace } from '$lib/repository';
  import SuccessNotice from './SuccessNotice.svelte';
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  import { onMount } from 'svelte';
  import { getAuth } from 'firebase/auth';
  let entries = $state<
    { email: string; enabled: boolean; permanent: boolean; passwordEnabled: boolean }[]
  >([]);
  let email = $state('');
  let failure = $state('');
  let busy = $state(false);
  let passwordEmail = $state('');
  let password = $state('');
  let message = $state('');
  function editPassword(address: string) {
    passwordEmail = address;
    password = '';
    failure = '';
  }
  async function changePassword(address: string, enabled: boolean) {
    if (busy || workspace.readOnly) return;
    busy = true;
    failure = '';
    message = '';
    try {
      await api('/api/admin/password', {
        email: address,
        enabled,
        ...(enabled ? { password } : {})
      });
      entries = entries.map((entry) =>
        entry.email === address ? { ...entry, passwordEnabled: enabled } : entry
      );
      passwordEmail = '';
      password = '';
      message = enabled
        ? `Password salvata per ${address}.`
        : `Accesso con password disabilitato per ${address}.`;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    } finally {
      busy = false;
    }
  }
  async function request(body?: unknown) {
    if (body) assertWriteAccess();
    const token = await getAuth().currentUser?.getIdToken();
    if (body) assertWriteAccess();
    const response = await fetch('/api/admin/access', {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Operazione non riuscita.');
    return data;
  }
  async function load() {
    try {
      entries = await request();
    } catch (e) {
      failure = (e as Error).message;
    }
  }
  async function change(address: string, enabled: boolean) {
    busy = true;
    failure = '';
    try {
      await request({ email: address, enabled });
      refreshWorkspace();
      email = '';
      passwordEmail = '';
      password = '';
      await load();
    } catch (e) {
      failure = (e as Error).message;
    } finally {
      busy = false;
    }
  }
  onMount(() => {
    void load();
  });
</script>

<section class="editor">
  <h2>Accessi Bacaro</h2>
  <p>
    Gli account abilitati possono accedere con Google oppure con una password impostata dal
    superadmin. La revoca vale anche se l’email compare in ALLOW_LIST.
  </p>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void change(email, true);
    }}
  >
    <label>Email<input type="email" required bind:value={email} /></label><button
      disabled={busy || workspace.readOnly}>Abilita accesso</button
    >
  </form>
  {#if failure}<p role="alert">{failure}</p>{/if}
  <SuccessNotice {message} ondismiss={() => (message = '')} />
  {#each entries as entry}<div class="access-entry" data-email={entry.email}>
      <div class="search-summary">
        <span class="uid"
          >{entry.email} · {entry.permanent
            ? 'Superadmin'
            : entry.enabled
              ? 'Abilitato'
              : 'Revocato'}</span
        >{#if !entry.permanent}<button
            disabled={busy || workspace.readOnly}
            onclick={() => change(entry.email, !entry.enabled)}
            >{entry.enabled ? 'Revoca' : 'Riabilita'}</button
          >{/if}
      </div>
      <p>Accesso con password: {entry.passwordEnabled ? 'Abilitato' : 'Non configurato'}</p>
      {#if entry.enabled}<button
          type="button"
          disabled={busy || workspace.readOnly}
          onclick={() => editPassword(entry.email)}
        >
          {entry.passwordEnabled ? 'Cambia password' : 'Imposta password'}
        </button>{/if}
      {#if entry.passwordEnabled}<button
          type="button"
          disabled={busy || workspace.readOnly}
          onclick={() => changePassword(entry.email, false)}>Disabilita accesso con password</button
        >{/if}
      {#if passwordEmail === entry.email && entry.enabled}
        <form
          aria-label={'Password per ' + entry.email}
          onsubmit={(event) => {
            event.preventDefault();
            void changePassword(entry.email, true);
          }}
        >
          <label
            >Nuova password<input
              type="password"
              autocomplete="new-password"
              minlength="12"
              maxlength="128"
              required
              bind:value={password}
              disabled={busy || workspace.readOnly}
            /></label
          >
          <small>Da 12 a 128 caratteri. Comunica la password direttamente alla persona.</small>
          <div class="password-actions">
            <button disabled={busy || workspace.readOnly}>Salva password</button>
            <button type="button" disabled={busy} onclick={() => editPassword('')}>Annulla</button>
          </div>
        </form>
      {/if}
    </div>{/each}
</section>

<style>
  .access-entry {
    border-top: 1px solid var(--line);
    margin-top: 1rem;
    padding-top: 1rem;
    overflow-wrap: anywhere;
  }
  .access-entry > button {
    margin: 0 0.5rem 0.5rem 0;
  }
  form {
    max-width: 520px;
  }
  .password-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
  }
</style>
