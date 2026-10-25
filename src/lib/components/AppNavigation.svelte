<script lang="ts">
  import { page } from '$app/state';
  const section = $derived(
    page.url.pathname.startsWith('/backoffice')
      ? 'gestione'
      : page.url.pathname.startsWith('/topic')
        ? 'topic'
        : 'speaker'
  );
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
  const links = [
    {
      id: 'speaker',
      label: 'Speaker',
      href: '/',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'
    },
    {
      id: 'topic',
      label: 'Topic',
      href: '/topic',
      icon: 'M20 13 13 20a2 2 0 0 1-3 0L2 12V2h10l8 8a2 2 0 0 1 0 3ZM7 7h.01'
    },
    {
      id: 'gestione',
      label: 'Gestione',
      href: '/backoffice',
      icon: 'M4 7h16M4 17h16M8 4v6M16 14v6'
    }
  ];
</script>

<footer class="app-footer">
  {#if section === 'gestione'}
    <div class="section-navigation">
      <nav aria-label="Gestione">
        {#each tabs as tab}<a
            href={tab.href}
            aria-current={activeTab === tab.id ? 'page' : undefined}>{tab.label}</a
          >{/each}
      </nav>
    </div>
  {/if}
  <nav aria-label="Navigazione principale">
    {#each links as link}
      <a href={link.href} aria-current={section === link.id ? 'page' : undefined}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"><path d={link.icon} /></svg
        >
        <span>{link.label}</span>
      </a>
    {/each}
  </nav>
</footer>

<style>
  .app-footer {
    display: block;
    position: fixed;
    inset: auto 0 0;
    z-index: 30;
    margin: 0;
    padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px)
      env(safe-area-inset-left, 0px);
    background: #fff;
    border-top: 1px solid var(--line);
  }
  nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: 640px;
    margin: auto;
  }
  a {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: 64px;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 600;
    border-top: 3px solid transparent;
  }
  a[aria-current='page'] {
    border-color: var(--blue);
    color: var(--blue);
    background: #edf3fa;
  }
  .section-navigation {
    background: #edf3fa;
    border-bottom: 1px solid var(--line);
  }
  .section-navigation a {
    min-height: 48px;
    font-size: 0.82rem;
    border-top: 0;
    border-bottom: 3px solid transparent;
  }
  .section-navigation a[aria-current='page'] {
    border-bottom-color: var(--blue);
    background: #dce6f2;
  }
  a:hover {
    background: #edf3fa;
  }
</style>
