<script lang="ts">
  import { isInInterviewList } from '$lib/interview-list';
  import { team } from '$lib/team';
  import { untrack } from 'svelte';
  import {
    fields,
    labels,
    auditKeys,
    translate,
    type Collection,
    type Entity,
    type Field
  } from '$lib/fields';
  import { validateEntity } from '$lib/domain';
  import Markdown from './Markdown.svelte';
  let {
    collection,
    entity,
    members,
    onsave,
    oncancel,
    busy = false
  }: {
    collection: Collection;
    entity: Entity;
    members: Entity[];
    onsave: (entity: Entity) => Promise<void>;
    oncancel: () => void;
    busy?: boolean;
  } = $props();
  let draft = $state<Entity>(untrack(() => JSON.parse(JSON.stringify(entity))));
  let error = $state('');
  let previews = $state<Record<string, boolean>>({});
  let rawJson = $state<Record<string, string>>({});
  let advanced = $state(false);
  const mainKeys = [
    'fullName',
    'inInterviewList',
    'isKeynote',
    'headline',
    'organization',
    'biographyMd',
    'biographyIt',
    'biographyEn',
    'translationReviewed',
    'photoUrl',
    'tags',
    'title',
    'url',
    'bodyMd',
    'provenance',
    'notesMd',
    'abstractMd',
    'abstractIt',
    'abstractEn',
    'day',
    'time',
    'stage',
    'textIt',
    'textEn',
    'followUpIt',
    'followUpEn',
    'order',
    'status',
    'assignedToUid',
    'cameraId',
    'interviewStatus',
    'interviewLanguage',
    'priority',
    'date',
    'startTime',
    'targetQuestions'
  ];
  const visible = $derived(
    fields[collection].filter(
      (f) =>
        !['assignedToUid', 'assignedToName', 'assignedTeamId'].includes(f.key) &&
        (advanced || mainKeys.includes(f.key))
    )
  );
  function update(field: Field, value: string | boolean) {
    if (field.type === 'array')
      draft[field.key] = String(value)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
    else if (field.type === 'number') draft[field.key] = value === '' ? 0 : Number(value);
    else if (field.type === 'json') {
      rawJson[field.key] = String(value);
      try {
        draft[field.key] = JSON.parse(String(value));
        error = '';
      } catch {
        error = 'Link pubblici: JSON non valido.';
      }
    } else draft[field.key] = value;
    if (field.key === 'assignedToUid')
      draft.assignedToName = [...team, ...members].find((m) => m.id === value)?.displayName ?? null;
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    for (const [key, raw] of Object.entries(rawJson)) {
      try {
        draft[key] = JSON.parse(raw);
      } catch {
        error = `${key}: JSON non valido`;
        return;
      }
    }
    const errors = validateEntity(collection, draft);
    if (errors.length) {
      error = errors.join('\n');
      return;
    }
    try {
      await onsave(draft);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<section class="editor" aria-label="Modifica contenuto">
  <div class="section-heading">
    <h2>
      {entity.revision ? 'Modifica' : 'Aggiungi'} · {['materials', 'sources', 'insights'].includes(
        collection
      )
        ? 'Ricerca'
        : labels[collection]}
    </h2>
    <button type="button" class="quiet" onclick={oncancel} disabled={busy}>Chiudi</button>
  </div>
  <form onsubmit={save}>
    {#if collection === 'interviewPlans'}<p class="notice">
        Per assegnare o riassegnare usa «Assegna / cambia» nella scheda speaker.
      </p>{/if}
    {#each visible as field}
      <div class:wide={field.type === 'markdown'} class="field">
        <label for={'edit-' + field.key}>{field.label}</label>
        {#if field.key === 'assignedToUid'}
          <select
            id={'edit-' + field.key}
            value={String(draft[field.key] ?? '')}
            onchange={(e) => update(field, e.currentTarget.value)}
            ><option value="">Non assegnato</option
            >{#each [...team.filter((m) => m.role === 'interview'), ...members.filter((m) => !team.some((t) => t.id === m.id))] as member}<option
                value={member.id}>{member.displayName || member.id}</option
              >{/each}</select
          >
        {:else if field.type === 'boolean'}
          <input
            id={'edit-' + field.key}
            type="checkbox"
            checked={field.key === 'inInterviewList'
              ? isInInterviewList(draft)
              : Boolean(draft[field.key])}
            onchange={(e) => update(field, e.currentTarget.checked)}
          />
        {:else if field.type === 'select'}
          <select
            id={'edit-' + field.key}
            value={String(draft[field.key] ?? '')}
            onchange={(e) => update(field, e.currentTarget.value)}
            ><option value="">Non specificato</option
            >{#if draft[field.key] && !field.options?.includes(String(draft[field.key]))}<option
                value={String(draft[field.key])}>{String(draft[field.key])}</option
              >{/if}{#each field.options || [] as option}<option value={option}
                >{translate(option)}</option
              >{/each}</select
          >
        {:else if field.type === 'markdown'}
          <textarea
            id={'edit-' + field.key}
            rows={field.key === 'bodyMd' ? 12 : 4}
            value={String(draft[field.key] ?? '')}
            oninput={(e) => update(field, e.currentTarget.value)}></textarea>
          <button
            type="button"
            class="text-button"
            onclick={() => (previews[field.key] = !previews[field.key])}
            >{previews[field.key] ? 'Nascondi anteprima' : 'Anteprima Markdown'}</button
          >
          {#if field.key === 'bodyMd'}<small
              >{new TextEncoder()
                .encode(String(draft[field.key] || ''))
                .length.toLocaleString('it-IT')} / 204.800 byte · nessun tag obbligatorio</small
            >{/if}
          {#if previews[field.key]}<div class="preview">
              <Markdown text={String(draft[field.key] || '')} />
            </div>{/if}
        {:else if field.type === 'json'}
          <textarea
            id={'edit-' + field.key}
            rows="4"
            value={rawJson[field.key] ?? JSON.stringify(draft[field.key] || [], null, 2)}
            oninput={(e) => update(field, e.currentTarget.value)}></textarea>
        {:else}
          <input
            id={'edit-' + field.key}
            type={field.type === 'number' ? 'number' : 'text'}
            min={field.type === 'number' ? 0 : undefined}
            value={field.type === 'array'
              ? ((draft[field.key] as string[]) || []).join(', ')
              : String(draft[field.key] ?? '')}
            oninput={(e) => update(field, e.currentTarget.value)}
          />
          {#if field.type === 'array'}<small>Valori separati da virgola</small>{/if}
        {/if}
      </div>
    {/each}
    <div class="wide">
      <button type="button" class="text-button" onclick={() => (advanced = !advanced)}
        >{advanced ? 'Nascondi campi aggiuntivi' : 'Mostra tutti i campi editoriali'}</button
      >
    </div>
    {#if error}<p class="error wide" role="alert">{error}</p>{/if}
    <div class="form-actions wide">
      <button class="primary" disabled={busy} type="submit"
        >{busy ? 'Salvataggio…' : 'Salva modifiche'}</button
      ><button type="button" onclick={oncancel} disabled={busy}>Annulla</button>
    </div>
  </form>
  <details class="technical">
    <summary>ID e cronologia</summary>
    <p>{entity.id}</p>
    {#each auditKeys as key}{#if entity[key] !== undefined}<p>
          {key}: {JSON.stringify(entity[key])}
        </p>{/if}{/each}
  </details>
</section>
