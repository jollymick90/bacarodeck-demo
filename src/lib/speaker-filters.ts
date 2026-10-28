import type { Entity } from './fields';

export type InterviewFilter = 'pending' | 'completed' | 'all';
export type AssignmentFilter = 'all' | 'self' | 'others' | 'unassigned';
export type SpeakerFilters = { interview: InterviewFilter; assignment: AssignmentFilter };

export function readSpeakerFilters(
  params: URLSearchParams,
  defaultInterview: InterviewFilter = 'all'
): SpeakerFilters {
  const interview = params.get('intervista');
  const assignment = params.get('assegnazione');
  return {
    interview:
      interview === 'pending' || interview === 'completed' || interview === 'all'
        ? interview
        : params.get('fatte') === '1'
          ? 'all'
          : defaultInterview,
    assignment:
      assignment === 'self' || assignment === 'others' || assignment === 'unassigned'
        ? assignment
        : 'all'
  };
}

export function assignmentRelationship(
  plan: Entity | undefined,
  actorUid: string,
  assignees: Entity[]
): 'self' | 'others' | 'unassigned' | 'unknown' {
  const canonicalId = String(plan?.assignedTeamId || '').trim();
  const legacyUid = String(plan?.assignedToUid || '').trim();
  const legacyName = String(plan?.assignedToName || '')
    .trim()
    .toLocaleLowerCase('it');
  if (!canonicalId && !legacyUid && !legacyName) return 'unassigned';
  if (!actorUid) return 'unknown';
  const actorIds = new Set(assignees.filter((m) => m.uid === actorUid).map((m) => m.id));
  const relationship = (member: Entity | undefined) => {
    if (!member) return 'unknown';
    if (actorIds.has(member.id)) return 'self';
    return member.uid || actorIds.size ? 'others' : 'unknown';
  };
  // A canonical reassignment wins over stale UID/name fields.
  if (canonicalId) {
    if (actorIds.has(canonicalId)) return 'self';
    if (actorIds.size) return 'others';
    return relationship(assignees.find((m) => m.id === canonicalId));
  }
  if (legacyUid) return legacyUid === actorUid ? 'self' : 'others';
  const matches = assignees.filter(
    (m) =>
      String(m.displayName || '')
        .trim()
        .toLocaleLowerCase('it') === legacyName
  );
  return matches.length === 1 ? relationship(matches[0]) : 'unknown';
}

export function filterSpeakers(
  speakers: Entity[],
  plans: Entity[],
  actorUid: string,
  assignees: Entity[],
  filters: SpeakerFilters
): Entity[] {
  return speakers.filter((speaker) => {
    const plan = plans.find((p) => p.speakerId === speaker.id);
    const completed = plan?.interviewStatus === 'completed';
    return (
      (filters.interview === 'all' ||
        (filters.interview === 'completed' ? completed : !completed)) &&
      (filters.assignment === 'all' ||
        assignmentRelationship(plan, actorUid, assignees) === filters.assignment)
    );
  });
}
