import { expect, it } from 'vitest';
import { suggestInterview, findConflicts, localTime } from '../src/lib/scheduling';
it('uses 30 minutes after the end and Rome timezone', () => {
  expect(suggestInterview('2026-10-28T11:50:00+01:00')).toBe('2026-10-28T11:20:00.000Z');
  expect(localTime('2026-10-28T11:20:00Z')).toContain('12:20');
});
it('flags resource overlap but permits adjacent interviews', () => {
  const a = { id: 'a', chosenStart: '2026-10-28T12:00:00Z', cameraId: 'danilo' };
  expect(findConflicts([a, { ...a, id: 'b', chosenStart: '2026-10-28T12:20:00Z' }])).toHaveLength(
    1
  );
  expect(findConflicts([a, { ...a, id: 'b', chosenStart: '2026-10-28T12:30:00Z' }])).toHaveLength(
    0
  );
});

import { outsideWindows } from '../src/lib/scheduling';
it('flags late suggestions and slots crossing the end of the working window', () => {
  expect(outsideWindows('2026-10-28T18:50:00+01:00')).toBe(true);
  expect(outsideWindows('2026-10-29T15:45:00+01:00')).toBe(true);
  expect(outsideWindows('2026-10-28T12:20:00+01:00')).toBe(false);
});
