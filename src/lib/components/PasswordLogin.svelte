<script lang="ts">
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  async function login() {
    if (busy) return;
    busy = true;
    try {
      if (await workspace.loginWithPassword(email, password)) password = '';
    } finally {
      busy = false;
    }
  }
</script>

<form
  aria-label="Accesso con email e password"
  onsubmit={(event) => {
    event.preventDefault();
    void login();
  }}
>
  <h2>Oppure email e password</h2>
  <p>Per gli account a cui il superadmin ha impostato una password.</p>
  <label
    >Email<input
      type="email"
      required
      autocomplete="username"
      bind:value={email}
      disabled={busy}
    /></label
  >
  <label
    >Password<input
      type="password"
      required
      autocomplete="current-password"
      bind:value={password}
      disabled={busy}
    /></label
  >
  <button class="primary" disabled={busy || !workspace.online}
    >{busy ? 'Accesso in corso…' : 'Accedi con email e password'}</button
  >
</form>

<style>
  form {
    max-width: 420px;
    margin-top: 1.5rem;
  }
  h2 {
    font-size: 1.2rem;
  }
  form p {
    font-size: 0.9rem;
  }
  label {
    display: block;
    margin: 0.75rem 0;
  }
  button {
    min-height: 44px;
    margin-top: 0.5rem;
  }
</style>
