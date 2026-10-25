import { expect, it } from 'vitest';
import { interestId } from '../src/lib/server/conductor-interests';
it('separates member interests even when speaker is the same', () => {
  expect(interestId('alberto', 'g')).not.toBe(interestId('martin', 'g'));
  expect(interestId('alberto', 'g')).toMatch(/^[a-f0-9]{64}$/);
  expect(interestId('alberto', 'g')).toBe(interestId('alberto', 'g'));
});
