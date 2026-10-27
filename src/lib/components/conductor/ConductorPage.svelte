<script lang="ts">
  import { page } from '$app/state';
  import { getWorkspace } from '$lib/workspace.svelte';
  import { commitChanges } from '$lib/repository';
  import Conductor from './Conductor.svelte';

  let {
    mode = 'home',
    speakerId = '',
    topic = ''
  }: {
    mode?: 'home' | 'speakers' | 'speaker' | 'reading' | 'topics' | 'topic';
    speakerId?: string;
    topic?: string;
  } = $props();
  const workspace = getWorkspace();
</script>

{#key `${mode}:${speakerId}:${topic}:${page.url.searchParams.get('talk') || ''}`}
  <Conductor
    data={workspace.data}
    members={workspace.members}
    assignees={workspace.assignees}
    uid={workspace.user!.uid}
    {mode}
    selected={speakerId}
    {topic}
    onquestion={async (question) => {
      await commitChanges(workspace.client!.db, workspace.user!.uid, [
        { collection: 'questions', data: question, expectedRevision: question.revision ?? null }
      ]);
    }}
  />
{/key}
