import type { Entity } from '../fields';
export function groupSpeakers(
  speakers: Entity[],
  interests: Entity[],
  plans: Entity[],
  actorUid: string,
  topic = ''
) {
  const saved = new Set(interests.filter((i) => i.memberUid === actorUid).map((i) => i.speakerId));
  return {
    saved: speakers.filter((s) => saved.has(s.id)),
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
