<script lang="ts">
  import { getWorkspace } from '$lib/workspace.svelte';
  const workspace = getWorkspace();
  import agenda from '../../../data/agenda/codemotion.json';
  import { localTime, suggestInterview, findConflicts, outsideWindows } from '$lib/scheduling';
  import { team } from '$lib/team';
  import type { Entity } from '$lib/fields';
  let { slots, onsave }: { slots: Entity[]; onsave: (slot: Entity) => Promise<void> } = $props();
  let failure = $state('');
  let busy = $state(false);
  let draft = $state<Entity | null>(null);
  const initial: Entity[] = agenda.originalSlots.map((slot, i) => ({
    id: `slot-${i + 1}`,
    originalStart: `${slot.day}T${slot.startTime}:00+01:00`,
    primarySpeaker: slot.mainSpeaker,
    backupSpeaker: slot.backupSpeaker,
    status: 'provisional'
  }));
  const rows = $derived(initial.map((slot) => slots.find((saved) => saved.id === slot.id) || slot));
  const conflicts = $derived(findConflicts(rows));
  const talks = $derived(
    agenda.sessions.filter((talk) => talk.speakers.includes(String(draft?.primarySpeaker)))
  );
  async function save() {
    if (!draft) return;
    busy = true;
    failure = '';
    try {
      await onsave(draft);
      draft = null;
    } catch (e) {
      failure = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<section class="editor">
  <h2>Programmazione interviste</h2>
  <p>
    Slot da 30 minuti · Europe/Rome · agenda consultata il {agenda.retrievedOn}.
    <a href={agenda.source} target="_blank" rel="noreferrer">Agenda ufficiale</a>
  </p>
  <p>
    Le coppie principale/backup restano quelle della proposta originale. I suggerimenti non sono
    conferme.
  </p>
  {#each conflicts as conflict}<p class="warning">{conflict}</p>{/each}
  {#if failure}<p role="alert">{failure}</p>{/if}
  {#if draft}<form
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h3>{draft.primarySpeaker}</h3>
      <p>Backup: {draft.backupSpeaker}</p>
      <button
        type="button"
        onclick={() => {
          if (draft)
            draft = {
              ...draft,
              primarySpeaker: draft.backupSpeaker,
              backupSpeaker: draft.primarySpeaker,
              selectedTalkId: ''
            };
        }}>Scambia principale e backup</button
      >
      <label
        >Talk di riferimento<select
          value={String(draft.selectedTalkId || '')}
          onchange={(event) => {
            if (draft) draft.selectedTalkId = event.currentTarget.value;
          }}
          ><option value="">Seleziona un talk</option>{#each talks as talk}<option
              value={talk.sessionId}>{localTime(talk.startsAt)} — {talk.title}</option
            >{/each}</select
        ></label
      >
      {#if !talks.length}<p class="warning">
          Nessun talk associato nello snapshot. Verificare nome e programma ufficiale.
        </p>{/if}
      {#each talks.filter((t) => t.sessionId === draft?.selectedTalkId) as talk}<p>
          Fine talk: {localTime(talk.endsAt)} · Intervista suggerita: {localTime(
            suggestInterview(talk.endsAt)
          )}
        </p>
        <button
          type="button"
          onclick={() => {
            if (draft) draft.chosenStart = suggestInterview(talk.endsAt);
          }}>Usa fine talk +30 minuti</button
        >{/each}
      <label
        >Inizio scelto (ISO con fuso)<input
          placeholder="2026-10-28T12:20:00+01:00"
          bind:value={draft.chosenStart}
        /></label
      >
      {#if draft.chosenStart && outsideWindows(String(draft.chosenStart))}<p
          class="warning"
          role="status"
        >
          Lo slot scelto è fuori dalle finestre della proposta originale. Concordare la
          disponibilità del team e dello speaker.
        </p>{/if}
      <p class="muted">
        Verifica gli orari fuori dalle finestre proposte (11–13 e 15–17 mercoledì; 11–13 e 15–16
        giovedì). Gli slot non sono prenotati automaticamente.
      </p>
      <label
        >Intervistatore<select disabled bind:value={draft.interviewerId}
          ><option value="">Da assegnare</option
          >{#if draft.interviewerId && !workspace.assignees.some((m) => m.id === draft?.interviewerId)}<option
              value={draft.interviewerId}
              >{team.find((m) => m.id === draft?.interviewerId)?.displayName || draft.interviewerId} (non
              abilitato)</option
            >{/if}{#each workspace.assignees as member}<option value={member.id}
              >{member.displayName}</option
            >{/each}</select
        ></label
      >
      <p class="muted">
        L’intervistatore si cambia dalla scheda speaker tramite «Assegna / cambia».
      </p>
      <label
        >Camera<select bind:value={draft.cameraId}
          ><option value="">Da assegnare</option
          >{#each team.filter((m) => m.role === 'camera') as member}<option value={member.id}
              >{member.displayName}</option
            >{/each}</select
        ></label
      >
      <label
        >Stato<select bind:value={draft.status}
          ><option value="proposed">Proposta</option><option value="provisional">Provvisoria</option
          ><option value="confirmed">Confermata</option></select
        ></label
      >
      <button disabled={busy}>Salva slot</button><button
        type="button"
        onclick={() => (draft = null)}>Annulla</button
      >
    </form>
  {:else}{#each rows as slot}<article class="content-entry">
        <p>Originale: {localTime(String(slot.originalStart))}</p>
        <h3>{slot.primarySpeaker}</h3>
        <p>Backup: {slot.backupSpeaker}</p>
        <p>
          {slot.chosenStart
            ? 'Scelto: ' + localTime(String(slot.chosenStart))
            : 'Orario ancora da concordare'} · {slot.status}
        </p>
        <button onclick={() => (draft = { ...slot })}>Organizza slot</button>
      </article>{/each}{/if}
</section>
