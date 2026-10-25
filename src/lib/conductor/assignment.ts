import type { Dataset, Entity } from '../fields';
import type { Change } from '../domain';
import { team } from '../team';
export const assignmentOwner = (plan?: Entity) =>
  String(plan?.assignedTeamId || plan?.assignedToUid || plan?.assignedToName || '');
export function assignmentChanges(
  data: Dataset,
  speakerId: string,
  teamId: string,
  expectedOwner: string,
  confirmReplacement: boolean
): Change[] {
  const speaker = data.speakers?.find((s) => s.id === speakerId);
  const member = team.find((t) => t.id === teamId && t.role === 'interview');
  if (!speaker || !member) throw new Error('Speaker o conduttore non valido.');
  const plan = data.interviewPlans?.find((p) => p.speakerId === speakerId);
  const current = assignmentOwner(plan);
  if (current !== expectedOwner)
    throw new Error('Conflitto: assegnazione cambiata. Riapri e conferma il nuovo riepilogo.');
  if (current && current !== teamId && !confirmReplacement)
    throw new Error('Conferma la riassegnazione.');
  const changes: Change[] = [
    {
      collection: 'interviewPlans',
      data: {
        ...plan,
        id: plan?.id || speakerId,
        speakerId,
        assignedTeamId: teamId,
        assignedToUid: '',
        assignedToName: member.displayName
      },
      expectedRevision: plan?.revision ?? null
    }
  ];
  const uniqueName = data.speakers?.filter((s) => s.fullName === speaker.fullName).length === 1;
  for (const slot of data.interviewSlots || []) {
    if (
      slot.primarySpeakerId === speakerId ||
      (!slot.primarySpeakerId && uniqueName && slot.primarySpeaker === speaker.fullName)
    )
      changes.push({
        collection: 'interviewSlots',
        data: { ...slot, primarySpeakerId: speakerId, interviewerId: teamId },
        expectedRevision: slot.revision ?? null
      });
  }
  return changes;
}
