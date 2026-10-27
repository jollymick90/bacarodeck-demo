import defaults from '../../data/agenda/codemotion-speakers.json';
import type { Dataset, Entity } from './fields';
export const scheduleKeys = ['day', 'time', 'endTime', 'stage', 'agendaSessionId'] as const;
type Session = {
  sessionId: string;
  title: string;
  speakers: string[];
  startsAt: string;
  endsAt: string;
  room: string;
};
const normalize = (value: unknown) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const dateParts = (iso: string) => {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`
  };
};
export function parseSchedule(input: unknown): Session[] {
  if (
    !input ||
    typeof input !== 'object' ||
    !('sessions' in input) ||
    !Array.isArray(input.sessions) ||
    input.sessions.length > 500
  )
    throw Error('Il JSON deve contenere un elenco sessions (massimo 500).');
  const seen = new Set<string>();
  return input.sessions.map((s: unknown, i) => {
    const row = s as Session;
    if (
      !row ||
      typeof row.sessionId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(row.sessionId) ||
      seen.has(row.sessionId) ||
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      !Array.isArray(row.speakers) ||
      !row.speakers.length ||
      row.speakers.some((n) => typeof n !== 'string' || !n.trim())
    )
      throw Error(`Sessione ${i + 1}: ID, titolo o speaker non valido/duplicato.`);
    seen.add(row.sessionId);
    for (const value of [row.startsAt, row.endsAt])
      if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value))
      )
        throw Error(`Sessione ${row.sessionId}: serve data/ora ISO con fuso orario.`);
    if (
      Date.parse(row.endsAt) <= Date.parse(row.startsAt) ||
      dateParts(row.startsAt).day !== dateParts(row.endsAt).day
    )
      throw Error(`Sessione ${row.sessionId}: intervallo orario non valido.`);
    if (row.room !== undefined && typeof row.room !== 'string')
      throw Error(`Sessione ${row.sessionId}: sala non valida.`);
    return { ...row, room: row.room || '' };
  });
}
const defaultSessions = parseSchedule(defaults);
function match(talk: Entity, data: Dataset, sessions: Session[]) {
  const names = (data.speakers || [])
    .filter((s) => ((talk.speakerIds as string[]) || []).includes(s.id))
    .map((s) => normalize(s.fullName));
  const candidates = sessions.filter((s) => s.speakers.some((n) => names.includes(normalize(n))));
  if (talk.agendaSessionId) return sessions.find((s) => s.sessionId === talk.agendaSessionId);
  const titles = [
    talk.title,
    ...(Array.isArray(talk.alternateTitles) ? talk.alternateTitles : [])
  ].map(normalize);
  const exact = candidates.filter((s) => titles.includes(normalize(s.title)));
  if (exact.length === 1) return exact[0];
  const speakerTalks = (data.talks || []).filter((t) =>
    ((t.speakerIds as string[]) || []).some((id) =>
      ((talk.speakerIds as string[]) || []).includes(id)
    )
  );
  if (!exact.length && candidates.length === 1 && speakerTalks.length === 1) return candidates[0];
  return undefined;
}
function fields(session: Session) {
  const start = dateParts(session.startsAt),
    end = dateParts(session.endsAt);
  return {
    day: start.day,
    time: start.time,
    endTime: end.time,
    stage: session.room,
    agendaSessionId: session.sessionId
  };
}
export function withScheduleDefaults(talk: Entity, data: Dataset, snapshot?: unknown): Entity {
  // A saved association also preserves deliberate clearing of all schedule fields.
  if (talk.agendaSessionId !== undefined || scheduleKeys.some((k) => Boolean(talk[k]))) return talk;
  const session = match(talk, data, snapshot ? parseSchedule(snapshot) : defaultSessions);
  return session ? { ...talk, ...fields(session) } : talk;
}
export function prepareScheduleImport(data: Dataset, snapshot: unknown = defaults) {
  const sessions = parseSchedule(snapshot),
    warnings: string[] = [],
    talks: Entity[] = [];
  for (const talk of data.talks || []) {
    const session = match(talk, data, sessions);
    if (!session) {
      warnings.push(`${talk.title || talk.id}: nessuna sessione identificata in modo univoco.`);
      continue;
    }
    talks.push({ id: talk.id, title: talk.title, speakerIds: talk.speakerIds, ...fields(session) });
  }
  return { data: { schemaVersion: 1, talks }, warnings, matched: talks.length };
}
export function scheduleLabel(talk: Entity): string {
  return [talk.day, [talk.time, talk.endTime].filter(Boolean).join('–'), talk.stage]
    .filter(Boolean)
    .join(' · ');
}
function romeInstant(day: unknown, time: unknown): string | undefined {
  if (
    typeof day !== 'string' ||
    typeof time !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return;
  const wall = Date.parse(`${day}T${time}:00Z`);
  if (!Number.isFinite(wall)) return;
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const local = dateParts(new Date(instant).toISOString());
    instant += wall - Date.parse(`${local.day}T${local.time}:00Z`);
  }
  const result = new Date(instant).toISOString(),
    local = dateParts(result);
  return local.day === day && local.time === time ? result : undefined;
}
export function talkStartTime(talk: Entity): number | undefined {
  const instant = romeInstant(talk.day, talk.time);
  return instant ? Date.parse(instant) : undefined;
}
export function agendaSessions(data: Dataset, snapshot?: unknown): Session[] {
  const sessions = snapshot ? parseSchedule(snapshot) : defaultSessions;
  return sessions.flatMap((session) => {
    const talks = (data.talks || []).filter(
      (t) => match(t, data, sessions)?.sessionId === session.sessionId
    );
    if (!talks.length) return [session];
    const talk = withScheduleDefaults(talks[0], data, snapshot);
    const startsAt = romeInstant(talk.day, talk.time),
      endsAt = romeInstant(talk.day, talk.endTime);
    if (!startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return [];
    return [{ ...session, startsAt, endsAt, room: String(talk.stage || '') }];
  });
}
