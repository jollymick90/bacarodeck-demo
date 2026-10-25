<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import type { User } from 'firebase/auth';
  let { user, onlogout }: { user: User | null; onlogout: () => Promise<void> } = $props();
  let accountPanel = $state<HTMLDivElement>();
  afterNavigate(() => accountPanel?.hidePopover());
  async function logout() {
    accountPanel?.hidePopover();
    await onlogout();
  }
</script>

<header class="app-header">
  <a class="app-brand" href="/" aria-label="Interview Hub">
    <img src="/bacarotech-logo.png" alt="BacaroTech" width="44" height="44" />
    <span>Interview Hub</span>
  </a>
  {#if user}
    <button class="user-button" popovertarget="account-panel">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        ><circle cx="12" cy="8" r="3.5" /><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" /></svg
      >
      Utente
    </button>
    <div id="account-panel" class="account-panel" popover bind:this={accountPanel}>
      <strong>{user.displayName || 'Il tuo account'}</strong>
      <p>{user.email}</p>
      <button onclick={logout}>Esci</button>
    </div>
  {/if}
</header>

<style>
  .app-header {
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 4px max(1rem, calc((100vw - 1280px) / 2));
    background: var(--blue);
    color: white;
  }
  .app-brand {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: inherit;
    text-decoration: none;
    font-size: 1rem;
    font-weight: 700;
    white-space: nowrap;
  }
  .app-brand img {
    object-fit: contain;
  }
  .user-button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: transparent;
    color: white;
    border-color: #8395b1;
    padding: 0.45rem 0.65rem;
    font-size: 0.85rem;
  }
  .user-button:hover {
    background: #294d78;
  }
  .account-panel {
    position: fixed;
    inset: 62px max(1rem, calc((100vw - 1280px) / 2)) auto auto;
    margin: 0;
    width: min(300px, calc(100vw - 2rem));
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: 10px;
    color: var(--blue);
    background: white;
    box-shadow: 0 8px 30px #182f5026;
    overflow-wrap: anywhere;
  }
  .account-panel p {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0.2rem 0 1rem;
  }
  .account-panel button {
    width: 100%;
  }
</style>
