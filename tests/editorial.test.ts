import { expect, it } from 'vitest';
import { parseImport, previewImport, selectedChanges } from '../src/lib/domain';
import catalog from '../data/seed/catalog.json';
import agenda from '../data/agenda/codemotion.json';
it('imports all 84 speakers without selecting updates to existing work', () => {
  const parsed = parseImport(JSON.stringify(catalog));
  expect(parsed.speakers).toHaveLength(84);
  const person = parsed.speakers![0];
  const existing = { ...person, fullName: 'Edited', revision: 3 };
  const changes = selectedChanges(previewImport(parsed, { speakers: [existing] }));
  expect(changes.some((c) => c.collection === 'speakers' && c.data.id === person.id)).toBe(false);
});
it('preserves fourteen main/backup pairs and 30 minute original slots', () => {
  expect(agenda.originalSlots).toHaveLength(14);
  expect(
    agenda.originalSlots.every((s) => s.durationMinutes === 30 && s.mainSpeaker && s.backupSpeaker)
  ).toBe(true);
});
