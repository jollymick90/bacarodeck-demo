import { expect, it } from 'vitest';
import {
  prepareScheduleImport,
  withScheduleDefaults,
  parseSchedule
} from '../src/lib/talk-schedule';
import { parseImport, previewImport, selectedChanges } from '../src/lib/domain';
const snapshot = {
  sessions: [
    {
      sessionId: 's1',
      title: 'Agent review',
      speakers: ['Ada Rossi'],
      startsAt: '2026-10-28T11:20:00+01:00',
      endsAt: '2026-10-28T11:50:00+01:00',
      room: 'BRERA'
    }
  ]
};
const data = {
  speakers: [{ id: 'ada', fullName: 'Ada Rossi' }],
  talks: [
    {
      id: 'talk-ada',
      speakerIds: ['ada'],
      title: 'Agent review',
      notesMd: 'Keep',
      time: '12:00',
      revision: 4
    }
  ]
};
it('prepares schedule-only updates for existing talks, preserving editorial content and revisions', () => {
  const result = prepareScheduleImport(data, snapshot);
  expect(result.matched).toBe(1);
  const input = parseImport(JSON.stringify(result.data));
  expect(input.talks?.[0]).toMatchObject({
    id: 'talk-ada',
    day: '2026-10-28',
    time: '11:20',
    endTime: '11:50',
    stage: 'BRERA',
    agendaSessionId: 's1'
  });
  expect(input.talks?.[0]).not.toHaveProperty('notesMd');
  const rows = previewImport(input, data);
  expect(selectedChanges(rows)).toEqual([]);
  for (const row of rows) for (const field of row.fields) field.selected = true;
  expect(selectedChanges(rows)[0]).toMatchObject({
    expectedRevision: 4,
    data: { notesMd: 'Keep', time: '11:20' }
  });
});
it('defaults are available before import but saved and explicitly cleared schedules win', () => {
  const blank = { ...data.talks[0], time: '' };
  expect(withScheduleDefaults(blank, { ...data, talks: [blank] }, snapshot).time).toBe('11:20');
  expect(withScheduleDefaults(data.talks[0], data, snapshot).time).toBe('12:00');
  expect(withScheduleDefaults({ ...blank, agendaSessionId: 's1' }, data, snapshot).time).toBe('');
});
it('matches title among multiple sessions and skips ambiguous or unmatched speakers', () => {
  const two = {
    sessions: [
      ...snapshot.sessions,
      { ...snapshot.sessions[0], sessionId: 's2', title: 'Other talk' }
    ]
  };
  expect(prepareScheduleImport(data, two).matched).toBe(1);
  const unknown = { ...data, talks: [{ ...data.talks[0], title: 'Unknown title' }] };
  expect(prepareScheduleImport(unknown, two).matched).toBe(0);
  expect(prepareScheduleImport(unknown, two).warnings.length).toBeGreaterThan(0);
  expect(
    prepareScheduleImport(
      { ...data, speakers: [{ id: 'ada', fullName: 'Another person' }] },
      snapshot
    ).matched
  ).toBe(0);
});
it('rejects duplicate session IDs and invalid ranges without partially importing', () => {
  expect(() => parseSchedule({ sessions: [...snapshot.sessions, ...snapshot.sessions] })).toThrow();
  expect(() =>
    parseSchedule({ sessions: [{ ...snapshot.sessions[0], endsAt: '2026-10-28T10:00:00+01:00' }] })
  ).toThrow();
  expect(() =>
    parseSchedule({ sessions: [{ ...snapshot.sessions[0], startsAt: 'not a date' }] })
  ).toThrow();
});
it('uses edited talk times for planning suggestions instead of the bundled snapshot', async () => {
  const { agendaSessions } = await import('../src/lib/talk-schedule');
  const edited = {
    ...data,
    talks: [
      {
        ...data.talks[0],
        agendaSessionId: 's1',
        day: '2026-10-28',
        time: '15:10',
        endTime: '15:40',
        stage: 'ROOM'
      }
    ]
  };
  expect(agendaSessions(edited, snapshot)[0]).toMatchObject({
    startsAt: '2026-10-28T14:10:00.000Z',
    endsAt: '2026-10-28T14:40:00.000Z',
    room: 'ROOM'
  });
});

it('keeps an explicit session association when the speaker display name changes', () => {
  const renamed = {
    speakers: [{ id: 'ada', fullName: 'Ada R.' }],
    talks: [{ ...data.talks[0], agendaSessionId: 's1' }]
  };
  expect(prepareScheduleImport(renamed, snapshot).matched).toBe(1);
});
