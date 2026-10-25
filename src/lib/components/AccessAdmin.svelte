<script lang="ts">
  import { refreshWorkspace } from '$lib/repository';
  import { onMount } from 'svelte';
  import { getAuth } from 'firebase/auth';
  let entries = $state<{ email: string; enabled: boolean; permanent: boolean }[]>([]);
  let email = $state('');
  let failure = $state('');
  let busy = $state(false);
  async function request(body?: unknown) {
    const token = await getAuth().currentUser?.getIdToken();
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
    Gli account abilitati possono accedere con Google. La revoca vale anche se l’email compare in
    ALLOW_LIST.
  </p>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void change(email, true);
    }}
  >
    <label>Email Google<input type="email" required bind:value={email} /></label><button
      disabled={busy}>Abilita accesso</button
    >
  </form>
  {#if failure}<p role="alert">{failure}</p>{/if}
  {#each entries as entry}<div class="search-summary">
      <span class="uid"
        >{entry.email} · {entry.permanent
          ? 'Superadmin'
          : entry.enabled
            ? 'Abilitato'
            : 'Revocato'}</span
      >{#if !entry.permanent}<button
          disabled={busy}
          onclick={() => change(entry.email, !entry.enabled)}
          >{entry.enabled ? 'Revoca' : 'Riabilita'}</button
        >{/if}
    </div>{/each}
</section>
