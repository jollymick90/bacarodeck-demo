import type { Dataset, Entity } from '../fields';
import { talkStartTime, withScheduleDefaults } from '../talk-schedule';

export function firstSpeakerTalk(speakerId: string, data: Dataset): Entity | undefined {
  return (data.talks || [])
    .filter((talk) => ((talk.speakerIds as string[]) || []).includes(speakerId))
    .map((talk) => withScheduleDefaults(talk, data))
    .toSorted((a, b) => {
      const first = talkStartTime(a) ?? Infinity;
      const second = talkStartTime(b) ?? Infinity;
      return first === second ? 0 : first < second ? -1 : 1;
    })[0];
}

export function sortSpeakersByTalk(speakers: Entity[], data: Dataset): Entity[] {
  return speakers
    .map((speaker) => {
      const talk = firstSpeakerTalk(speaker.id, data);
      return { speaker, start: (talk && talkStartTime(talk)) ?? Infinity };
    })
    .toSorted((a, b) =>
      a.start === b.start
        ? String(a.speaker.fullName || '').localeCompare(String(b.speaker.fullName || ''), 'it') ||
          a.speaker.id.localeCompare(b.speaker.id)
        : a.start < b.start
          ? -1
          : 1
    )
    .map(({ speaker }) => speaker);
}

export function groupSpeakers(
  speakers: Entity[],
  interests: Entity[],
  plans: Entity[],
  actorUid: string,
  topic = '',
  assignees: Entity[] = [],
  includeCompleted = false
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
  const completed = new Set(
    plans.filter((plan) => plan.interviewStatus === 'completed').map((plan) => plan.speakerId)
  );
  const visible = speakers.filter((speaker) => includeCompleted || !completed.has(speaker.id));
  return {
    saved: visible.filter((s) => saved.has(s.id)),
    assigned: visible.filter((s) => assigned.has(s.id)),
    personal: visible.filter((s) => saved.has(s.id) || assigned.has(s.id)),
    completed: speakers.filter(
      (s) => completed.has(s.id) && (saved.has(s.id) || assigned.has(s.id))
    ),
    unassigned: visible.filter(
      (s) =>
        !completed.has(s.id) &&
        !saved.has(s.id) &&
        s.status !== 'archived' &&
        (!topic || ((s.tags as string[]) || []).includes(topic)) &&
        !plans.some(
          (p) => p.speakerId === s.id && (p.assignedTeamId || p.assignedToUid || p.assignedToName)
        )
    ),
    all: visible.filter((s) => !topic || ((s.tags as string[]) || []).includes(topic))
  };
}
