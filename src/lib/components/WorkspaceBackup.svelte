<script lang="ts">
  import { onDestroy } from 'svelte';
  import { getAuth } from 'firebase/auth';
  import {
    backupCollections,
    makeBackup,
    type BackupData,
    parseBackup,
    planRestore,
    restoreBatches,
    type WorkspaceBackup,
    type RestoreChange
  } from '$lib/workspace-backup';
  import { labels } from '$lib/fields';
  let {
    superadmin,
    oncancel,
    onrestored,
    onbusychange
  }: {
    superadmin: boolean;
    oncancel: () => void;
    onrestored: () => void;
    onbusychange: (busy: boolean) => void;
  } = $props();
  let backup = $state<WorkspaceBackup | null>(null);
  let changes = $state<RestoreChange[]>([]);
  let busy = $state(false);
  let approved = $state(false);
  let failure = $state('');
  let progress = $state('');
  let target = $state('');
  let page = $state(0);
  let active = true;
  $effect(() => {
    onbusychange(busy);
  });
  onDestroy(() => {
    active = false;
    onbusychange(false);
  });
  const visible = $derived(changes.slice(page * 30, (page + 1) * 30));
  async function request(body?: unknown, query = '') {
    if (!active) throw new Error('Operazione interrotta.');
    const user = getAuth().currentUser;
    if (!user) throw new Error('Accedi con Google.');
    target = getAuth().app.options.projectId || 'progetto corrente';
    const response = await fetch('/api/backup' + query, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Operazione non riuscita.');
    return result;
  }
  async function getCompleteBackup(): Promise<WorkspaceBackup> {
    const data: Partial<BackupData> = {};
    for (const collection of backupCollections) {
      const records = [];
      let offset: number | null = 0;
      let version = '';
      do {
        const query = new URLSearchParams({ collection, offset: String(offset) });
        if (version) query.set('version', version);
        const result = await request(undefined, '?' + query);
        records.push(...result.records);
        version = result.version;
        offset = result.next;
      } while (offset !== null);
      data[collection] = records;
    }
    return parseBackup(JSON.stringify(makeBackup(data)));
  }
  async function download() {
    busy = true;
    failure = '';
    progress = '';
    try {
      const result = await getCompleteBackup();
      const text = JSON.stringify(result, null, 2);
      parseBackup(text);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bacarodeck-completo-${new Date().toISOString().replaceAll(':', '-')}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      progress = 'Backup completo scaricato.';
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  async function preview(source: WorkspaceBackup) {
    const destination = await getCompleteBackup();
    changes = planRestore(source, destination);
    restoreBatches(changes);
    approved = false;
    page = 0;
  }
  async function loadFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    busy = true;
    failure = '';
    progress = '';
    backup = null;
    changes = [];
    approved = false;
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error('File superiore a 100 MiB: dividilo prima del ripristino.');
      const source = parseBackup(await file.text());
      await preview(source);
      backup = source;
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  async function reloadPreview() {
    if (!backup) return;
    busy = true;
    failure = '';
    approved = false;
    try {
      await preview(backup);
    } catch (e) {
      failure = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
  async function restore() {
    if (!approved || !backup || !changes.length || busy) return;
    busy = true;
    failure = '';
    approved = false;
    const batches = restoreBatches(changes);
    let saved = 0;
    try {
      for (const [index, batch] of batches.entries()) {
        progress = `Ripristino blocco ${index + 1} di ${batches.length}… ${saved} operazioni completate.`;
        await request({ changes: batch });
        saved += batch.length;
      }
      progress = `Ripristino completo: ${saved} operazioni completate.`;
      changes = [];
      onrestored();
    } catch (e) {
      failure = `${saved} operazioni confermate. I blocchi precedenti restano salvati. Ricarica l’anteprima prima di riprovare. ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      busy = false;
    }
  }
</script>

<section class="import-panel" aria-label="Backup completo workspace">
  <div class="section-heading">
    <h2>Export e import completo</h2>
    <button disabled={busy} onclick={oncancel}>Chiudi backup completo</button>
  </div>
  <p>
    Include tutti gli speaker, talk, fonti, materiali, insight, domande, piani, programmazione,
    profili, voti e domande eliminate. Include anche i dati importati da JSON e la loro origine.
  </p>
  <p>
    Non contiene credenziali, account Google o autorizzazioni di accesso. I profili e i voti
    conservano gli ID originali: un nuovo account locale può avere un ID diverso e non eredita
    automaticamente i voti personali.
  </p>
  <p class="muted">
    L’export usa la cache server: modifiche esterne all’app possono richiedere fino a 5 minuti per
    comparire. Il file rappresenta le collezioni lette durante l’esportazione, non una copia atomica
    del database; evita modifiche durante il trasferimento.
  </p>
  <button disabled={busy} onclick={download}>Scarica backup completo</button>
  {#if superadmin}
    <label
      >Apri backup completo<input
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onchange={loadFile}
      /></label
    >
    {#if backup}
      <p>File del {backup.exportedAt}. Destinazione: <strong>{target}</strong>.</p>
      <ul>
        {#each backupCollections as name}<li>
            {name in labels ? labels[name as keyof typeof labels] : name}: {backup.data[name]
              .length}
          </li>{/each}
      </ul>
      <p>
        {changes.filter((c) => !c.expected && c.data).length} nuovi · {changes.filter(
          (c) => c.expected && c.data
        ).length} da sostituire · {changes.filter((c) => !c.data).length} cancellazioni coerenti con lo
        stato delle domande nel file.
      </p>
      <p class="notice">
        Il ripristino aggiunge i documenti mancanti e sostituisce quelli con lo stesso ID. Conserva
        i dati locali assenti dal file, salvo le domande marcate come eliminate. I voti del file
        sostituiscono quelli dei documenti sovrascritti. I blocchi sono atomici singolarmente: un
        errore non annulla i blocchi già completati.
      </p>
      {#each visible as change}<details class="diff-row">
          <summary
            >{change.collection}/{change.id} · {change.data
              ? change.expected
                ? 'Sostituisci'
                : 'Aggiungi'
              : 'Elimina'}</summary
          >
          <div class="diff-values">
            <div>
              <small>Attuale</small>
              <pre>{JSON.stringify(change.expected, null, 2)}</pre>
            </div>
            <div>
              <small>Dal backup</small>
              <pre>{JSON.stringify(change.data, null, 2)}</pre>
            </div>
          </div>
        </details>{/each}
      {#if changes.length > 30}<div class="form-actions">
          <button disabled={busy || page === 0} onclick={() => page--}>Precedenti</button><span
            >Pagina {page + 1} di {Math.ceil(changes.length / 30)}</span
          ><button disabled={busy || (page + 1) * 30 >= changes.length} onclick={() => page++}
            >Successive</button
          >
        </div>{/if}
      <button disabled={busy} onclick={reloadPreview}>Ricarica anteprima completa</button>
      {#if !changes.length}<p>Nessuna differenza da ripristinare.</p>{/if}
      <label class="inline"
        ><input type="checkbox" disabled={busy} bind:checked={approved} />Ho verificato
        destinazione, sostituzioni e cancellazioni del backup completo</label
      >
      <button
        class="primary"
        disabled={busy || !approved || !changes.length || !!failure}
        onclick={restore}>Ripristina backup completo</button
      >
    {/if}
  {:else}<p>Per importare un backup completo devi essere superadmin della destinazione.</p>{/if}
  {#if progress}<p role="status">{progress}</p>{/if}
  {#if failure}<p role="alert" class="error">{failure}</p>{/if}
</section>
