import type { Entity } from '../fields';
export function groupSpeakers(
  speakers: Entity[],
  interests: Entity[],
  plans: Entity[],
  actorUid: string,
  topic = '',
  assignees: Entity[] = []
) {
  const saved = new Set(interests.filter((i) => i.memberUid === actorUid).map((i) => i.speakerId));
  const actorIds = new Set(
    assignees.filter((member) => actorUid && member.uid === actorUid).map((member) => member.id)
  );
  const assigned = new Set(
    plans
      .filter(
        (plan) =>
          actorUid &&
          (plan.assignedTeamId
            ? actorIds.has(String(plan.assignedTeamId))
            : plan.assignedToUid === actorUid)
      )
      .map((plan) => plan.speakerId)
  );
  return {
    saved: speakers.filter((s) => saved.has(s.id)),
    assigned: speakers.filter((s) => assigned.has(s.id)),
    personal: speakers.filter((s) => saved.has(s.id) || assigned.has(s.id)),
    unassigned: speakers.filter(
      (s) =>
        !saved.has(s.id) &&
        s.status !== 'archived' &&
        (!topic || ((s.tags as string[]) || []).includes(topic)) &&
        !plans.some(
          (p) => p.speakerId === s.id && (p.assignedTeamId || p.assignedToUid || p.assignedToName)
        )
    ),
    all: speakers.filter((s) => !topic || ((s.tags as string[]) || []).includes(topic))
  };
}
