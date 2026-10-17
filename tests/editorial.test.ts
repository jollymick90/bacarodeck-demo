import { expect, it } from 'vitest';
import { parseImport, previewImport, selectedChanges, validateEntity } from '../src/lib/domain';
import { draftQuestions } from '../src/lib/questions';
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
it('prepares ten valid bilingual exploratory questions with sources', () => {
  const person = catalog.speakers[0];
  const questions = draftQuestions(person, catalog.talks[0]);
  expect(questions).toHaveLength(10);
  for (const question of questions) {
    expect(validateEntity('questions', question)).toEqual([]);
    expect(question.textIt).toBeTruthy();
    expect(question.textEn).toBeTruthy();
  }
});
it('preserves fourteen main/backup pairs and 30 minute original slots', () => {
  expect(agenda.originalSlots).toHaveLength(14);
  expect(
    agenda.originalSlots.every((s) => s.durationMinutes === 30 && s.mainSpeaker && s.backupSpeaker)
  ).toBe(true);
});
