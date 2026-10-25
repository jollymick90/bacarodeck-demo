<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/repository';
  import { getWorkspace } from '$lib/workspace.svelte';
  import type { GraphNode, GraphEdge, GraphResponse, RelationKind } from '$lib/connections/types';
  import Graph3D from './Graph3D.svelte';
  const workspace = getWorkspace();
  let graph = $state<GraphResponse | null>(null);
  let error = $state('');
  let busy = $state(false);
  let loading = $state(true);
  let mobile = $state(true);
  let webglFailed = $state(false);
  let target = $state('');
  let relation = $state<RelationKind>('speaker-topic');
  let reason = $state('');
  let alive = true;
  let fetching = false;
  const selectedId = $derived(page.url.searchParams.get('node') || graph?.nodes[0]?.id || '');
  const selected = $derived(graph?.nodes.find((node) => node.id === selectedId));
  const query = $derived(page.url.searchParams.get('q') || '');
  const kind = $derived(page.url.searchParams.get('kind') || '');
  const depth = $derived(page.url.searchParams.get('depth') === '2' ? 2 : 1);
  const view = $derived(page.url.searchParams.get('view') || (mobile ? 'list' : '3d'));
  const nodes = $derived(graph?.nodes || []);
  const matches = $derived(
    nodes.filter(
      (node) =>
        (!kind || node.kind === kind) &&
        `${node.label} ${node.aliases?.join(' ') || ''}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase())
    )
  );
  const nodeMap = $derived(new Map(nodes.map((node) => [node.id, node])));
  const neighborhood = $derived.by(() => {
    const ids = new Set<string>(selected ? [selected.id] : []);
    const all = graph?.edges || [];
    for (let level = 0; level < depth; level++) {
      const frontier = new Set(ids);
      for (const edge of all) {
        if (!frontier.has(edge.source) && !frontier.has(edge.target)) continue;
        for (const id of [edge.source, edge.target]) {
          const node = nodeMap.get(id);
          if (ids.size < 40 && node && (!kind || node.kind === kind || id === selectedId))
            ids.add(id);
        }
      }
    }
    return {
      nodes: nodes.filter((node) => ids.has(node.id)),
      edges: all.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).slice(0, 60)
    };
  });
  const dismissed = $derived(
    (graph?.overrides || []).filter(
      (item) =>
        item.decision === 'dismissed' && (item.source === selectedId || item.target === selectedId)
    )
  );
  const labels: Record<string, string> = {
    speaker: 'Speaker',
    topic: 'Topic',
    question: 'Domanda',
    'speaker-topic': 'Speaker e topic',
    'question-topic': 'Domanda e topic',
    'topic-related': 'Topic affini',
    'speaker-similar': 'Speaker affini',
    'question-similar': 'Domande simili',
    explicit: 'Dai contenuti',
    automatic: 'Suggerimento automatico',
    manual: 'Collegamento manuale',
    confirmed: 'Confermato dal team'
  };
  function setParam(name: string, value: string, replace = false) {
    const params = new URLSearchParams(page.url.search);
    if (value) params.set(name, value);
    else params.delete(name);
    void goto('/topic/connessioni?' + params, {
      noScroll: true,
      keepFocus: true,
      replaceState: replace
    });
  }
  function select(id: string) {
    target = '';
    setParam('node', id);
  }
  async function load() {
    if (fetching || !workspace.online) {
      loading = false;
      return;
    }
    fetching = true;
    try {
      const result: GraphResponse = await api('/api/connections');
      if (alive) {
        graph = result;
        workspace.connections = result;
        error = '';
      }
    } catch (failure) {
      if (alive) error = (failure as Error).message;
    } finally {
      fetching = false;
      loading = false;
    }
  }
  async function refresh() {
    if (busy || !workspace.online) return;
    busy = true;
    error = '';
    try {
      await api('/api/connections', { action: 'refresh' });
      await load();
    } catch (failure) {
      error = (failure as Error).message;
    } finally {
      busy = false;
    }
  }
  async function decide(
    source: string,
    targetId: string,
    kind: RelationKind,
    decision: 'linked' | 'confirmed' | 'dismissed' | 'reset',
    explanation = ''
  ) {
    if (busy || !workspace.online) return;
    busy = true;
    error = '';
    const prior = graph?.overrides.find(
      (item) =>
        item.kind === kind &&
        ((item.source === source && item.target === targetId) ||
          (item.source === targetId && item.target === source))
    );
    try {
      await api('/api/connections', {
        action: 'decision',
        source,
        target: targetId,
        kind,
        decision,
        reason: explanation,
        expectedRevision: prior?.revision ?? null
      });
      await load();
    } catch (failure) {
      error = (failure as Error).message;
      await load();
    } finally {
      busy = false;
    }
  }
  function validKinds(a: GraphNode | undefined, b: GraphNode | undefined): RelationKind[] {
    if (!a || !b || a.id === b.id) return [];
    const pair = [a.kind, b.kind];
    if (pair.includes('speaker') && pair.includes('topic')) return ['speaker-topic'];
    if (pair.includes('question') && pair.includes('topic')) return ['question-topic'];
    if (a.kind === b.kind)
      return [
        a.kind === 'speaker'
          ? 'speaker-similar'
          : a.kind === 'topic'
            ? 'topic-related'
            : 'question-similar'
      ];
    return [];
  }
  const allowedKinds = $derived(validKinds(selected, nodeMap.get(target)));
  $effect(() => {
    if (allowedKinds.length && !allowedKinds.includes(relation)) relation = allowedKinds[0];
  });
  onMount(() => {
    alive = true;
    graph = workspace.connections;
    mobile = matchMedia('(max-width: 700px)').matches;
    void load();
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !busy) void load();
    }, 5000);
    const online = () => {
      void load();
    };
    window.addEventListener('online', online);
    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener('online', online);
    };
  });
</script>

<div class="connections">
  <a href="/topic">Tutti i topic</a>
  <header>
    <div>
      <h1>Connessioni</h1>
      <p>
        Segui un tema tra speaker e domande. Verifica le affinità e condividi i collegamenti utili.
      </p>
    </div>
    <button
      disabled={busy || !workspace.online || graph?.status.state === 'running'}
      onclick={refresh}>Ricalcola affinità</button
    >
  </header>
  {#if error}<p class="error" role="alert">
      {error}
      <button
        disabled={busy || !workspace.online}
        onclick={() => {
          error = '';
          void load();
        }}>Riprova caricamento</button
      >
    </p>{/if}
  {#if loading}<p role="status">Caricamento connessioni…</p>{/if}
  {#if graph}
    <div class="job" role="status">
      {#if graph.status.state === 'pending'}Ricalcolo in attesa. Puoi esplorare i contenuti
        disponibili.
      {:else if graph.status.state === 'running'}Calcolo delle affinità in corso{graph.status.total
          ? `: ${graph.status.progress || 0} / ${graph.status.total}`
          : '…'}
      {:else if graph.status.state === 'error'}Calcolo non riuscito: {graph.status.error ||
          'Modello non disponibile.'}
        <button disabled={busy || !workspace.online} onclick={refresh}>Riprova calcolo</button>
      {:else}Affinità aggiornate.{/if}
      {#if graph.stale}<strong> I risultati automatici mostrati sono da aggiornare.</strong>{/if}
    </div>
    <div class="filters">
      <label
        >Cerca nodi<input
          type="search"
          value={query}
          oninput={(event) => setParam('q', event.currentTarget.value, true)}
          placeholder="Speaker, topic o domanda"
        /></label
      >
      <label
        >Tipo di nodo<select
          value={kind}
          onchange={(event) => setParam('kind', event.currentTarget.value)}
          ><option value="">Tutti</option><option value="speaker">Speaker</option><option
            value="topic">Topic</option
          ><option value="question">Domande</option></select
        ></label
      >
      <div class="view-switch" role="group" aria-label="Vista connessioni">
        <button aria-pressed={view === 'list'} onclick={() => setParam('view', 'list')}
          >Lista</button
        ><button aria-pressed={view === '3d'} onclick={() => setParam('view', '3d')}>3D</button>
      </div>
    </div>
    <div class="explorer">
      <aside aria-label="Scegli un nodo">
        <p class="muted">{matches.length} nodi</p>
        <div class="node-picker">
          {#each matches as node (node.id)}<button
              class:chosen={selectedId === node.id}
              aria-pressed={selectedId === node.id}
              onclick={() => select(node.id)}><small>{labels[node.kind]}</small>{node.label}</button
            >{:else}<p>Nessun nodo con questi filtri.</p>{/each}
        </div>
      </aside>
      <section class="neighborhood" aria-label="Connessioni del nodo selezionato">
        {#if selected}
          <div class="selection">
            <small>{labels[selected.kind]}</small>
            <h2>{selected.label}</h2>
            <a href={selected.href}>Apri contenuto</a>
          </div>
          <div class="depth">
            <button
              aria-pressed={depth === 2}
              onclick={() => setParam('depth', depth === 1 ? '2' : '1')}
              >{depth === 1 ? 'Espandi a due passaggi' : 'Mostra un solo passaggio'}</button
            ><small>Fino a 40 nodi e 60 collegamenti per vista.</small>
          </div>
          {#if view === '3d' && !webglFailed}
            <Graph3D
              nodes={neighborhood.nodes}
              edges={neighborhood.edges}
              selected={selectedId}
              onselect={select}
              onfailure={() => {
                webglFailed = true;
              }}
            />
            <p class="muted">
              Trascina per ruotare; rotella o due dita per zoomare. Blu: speaker; verde: topic;
              viola: domande. La lista sotto permette di navigare anche da tastiera.
            </p>
          {:else if webglFailed && view === '3d'}<p role="status">
              La vista 3D non è disponibile su questo dispositivo. Tutte le connessioni restano
              consultabili nella lista.
            </p>{/if}
          <h3>Collegamenti ({neighborhood.edges.length})</h3>
          <div class="edges">
            {#each neighborhood.edges as edge (edge.id)}{@render edgeCard(edge)}{:else}<p>
                Nessun collegamento con questi filtri. Puoi aggiungerne uno qui sotto.
              </p>{/each}
          </div>
          <details class="manual">
            <summary>Aggiungi un collegamento</summary>
            <form
              onsubmit={(event) => {
                event.preventDefault();
                void decide(selectedId, target, relation, 'linked', reason);
              }}
            >
              <label
                >Collega a<select bind:value={target}
                  ><option value="">Scegli un nodo</option
                  >{#each nodes.filter((node) => validKinds(selected, node).length) as node}<option
                      value={node.id}>{labels[node.kind]}: {node.label}</option
                    >{/each}</select
                ></label
              >
              <label
                >Relazione<select bind:value={relation} disabled={!allowedKinds.length}
                  >{#each allowedKinds as value}<option {value}>{labels[value]}</option
                    >{/each}</select
                ></label
              >
              <label
                >Motivazione<input
                  bind:value={reason}
                  maxlength="2000"
                  placeholder="Perché è utile per l’intervista?"
                /></label
              >
              <button class="primary" disabled={busy || !workspace.online || !allowedKinds.length}
                >Salva collegamento condiviso</button
              >
            </form>
          </details>
          <details class="dismissed">
            <summary>Collegamenti scartati ({dismissed.length})</summary
            >{#each dismissed as item}<article>
                <p>
                  {nodeMap.get(String(item.source))?.label || item.source} ↔ {nodeMap.get(
                    String(item.target)
                  )?.label || item.target}
                </p>
                <button
                  disabled={busy || !workspace.online}
                  onclick={() =>
                    decide(
                      String(item.source),
                      String(item.target),
                      item.kind as RelationKind,
                      'reset'
                    )}>Ripristina suggerimento</button
                >
              </article>{:else}<p>Nessun collegamento scartato per questo nodo.</p>{/each}
          </details>
        {:else}<p>
            {nodes.length
              ? 'Nodo non disponibile. Scegli uno dei nodi nell’elenco.'
              : 'Non ci sono ancora contenuti da collegare.'}
          </p>{/if}
      </section>
    </div>
  {/if}
</div>

{#snippet edgeCard(edge: GraphEdge)}
  <article class="edge">
    <small>{labels[edge.kind]} · {labels[edge.origin]}</small>
    <div class="edge-nodes">
      <button onclick={() => select(edge.source)}
        >{nodeMap.get(edge.source)?.label || edge.source}</button
      ><span aria-hidden="true">↔</span><button onclick={() => select(edge.target)}
        >{nodeMap.get(edge.target)?.label || edge.target}</button
      >
    </div>
    <p>{edge.reason}</p>
    {#if edge.score !== undefined}<small
        >Affinità automatica: {edge.score.toFixed(3)}. È un punteggio di similarità, non una
        probabilità.</small
      >{/if}
    <details>
      <summary>Fonti e contenuti di supporto ({edge.evidence.length})</summary
      >{#each edge.evidence as evidence}<blockquote>
          <p>{evidence.excerpt}</p>
          <small>{evidence.collection} · {evidence.id}</small>
        </blockquote>{:else}<p>
          Nessun estratto disponibile. Apri i contenuti per verificare il collegamento.
        </p>{/each}
      <p>
        <a href={nodeMap.get(edge.source)?.href || '/topic'}>Apri primo contenuto</a> ·
        <a href={nodeMap.get(edge.target)?.href || '/topic'}>Apri secondo contenuto</a>
      </p>
    </details>
    <div class="edge-actions">
      <button
        disabled={busy || !workspace.online || edge.origin === 'confirmed'}
        onclick={() => decide(edge.source, edge.target, edge.kind, 'confirmed')}>Conferma</button
      ><button
        disabled={busy || !workspace.online}
        onclick={() => decide(edge.source, edge.target, edge.kind, 'dismissed')}>Scarta</button
      >{#if edge.origin === 'manual' || edge.origin === 'confirmed'}<button
          disabled={busy || !workspace.online}
          onclick={() => decide(edge.source, edge.target, edge.kind, 'reset')}
          >Annulla decisione</button
        >{/if}
    </div>
  </article>
{/snippet}

<style>
  .connections {
    max-width: 1200px;
    margin: auto;
  }
  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: space-between;
    margin-block: 1rem;
  }
  header h1 {
    margin: 0;
  }
  header p {
    max-width: 65ch;
  }
  header button {
    flex-shrink: 0;
  }
  .job {
    padding: 0.8rem 1rem;
    border-left: 3px solid var(--blue);
    background: #e6edf8;
    margin-bottom: 1rem;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 1rem;
    margin-block: 1rem;
  }
  .filters label:first-child {
    flex: 1;
    min-width: 200px;
  }
  label {
    display: grid;
    gap: 0.35rem;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
  }
  .view-switch,
  .edge-actions,
  .depth {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  button[aria-pressed='true'],
  .node-picker .chosen {
    background: var(--blue);
    color: white;
  }
  .explorer {
    display: grid;
    grid-template-columns: minmax(180px, 260px) minmax(0, 1fr);
    gap: 1.5rem;
  }
  .node-picker {
    max-height: 68vh;
    overflow-y: auto;
    display: grid;
    gap: 0.35rem;
    align-content: start;
  }
  .node-picker button {
    text-align: left;
    overflow-wrap: anywhere;
  }
  .node-picker small {
    display: block;
    font-weight: 400;
  }
  .neighborhood {
    min-width: 0;
  }
  .selection h2 {
    margin: 0.2rem 0 0.5rem;
    overflow-wrap: anywhere;
  }
  .depth {
    margin-block: 1rem;
  }
  small,
  .muted {
    color: var(--muted);
  }
  .chosen small {
    color: inherit;
  }
  .edge {
    border-top: 1px solid var(--line);
    padding-block: 1.2rem;
  }
  .edge p {
    max-width: 75ch;
  }
  .edge-nodes {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
  }
  .edge-nodes button {
    background: transparent;
    border: 0;
    text-align: left;
    padding: 0.25rem;
    font-weight: 700;
    flex: 1;
    overflow-wrap: anywhere;
  }
  .edge details {
    margin-block: 0.8rem;
  }
  summary {
    cursor: pointer;
    min-height: 44px;
    padding-block: 0.5rem;
  }
  blockquote {
    border-left: 3px solid var(--line);
    padding-left: 1rem;
    margin-left: 0;
  }
  blockquote p {
    white-space: pre-wrap;
  }
  .manual,
  .dismissed {
    border-top: 1px solid var(--line);
    padding-block: 0.6rem;
  }
  form {
    display: grid;
    gap: 1rem;
    padding-bottom: 1rem;
  }
  @media (max-width: 700px) {
    header {
      display: block;
    }
    .explorer {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .node-picker {
      max-height: 200px;
    }
    .filters {
      gap: 0.7rem;
    }
    .edge-nodes {
      align-items: start;
    }
  }
</style>
