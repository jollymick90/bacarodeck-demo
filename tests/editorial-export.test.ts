import { expect, it } from 'vitest';
import {
  exportCandidates,
  buildEditorialExport,
  trackEditorialFields
} from '../src/lib/editorial-export';
import { parseImport, previewImport, selectedChanges } from '../src/lib/domain';

it('excludes unchanged known imports and requires review of legacy unknown documents', () => {
  const base = { speakers: [{ id: 's', fullName: 'Speaker', notesMd: '' }] };
  const rows = exportCandidates({ ...base, materials: [{ id: 'old', title: 'Unknown origin' }] }, [
    base
  ]);
  expect(rows).toHaveLength(1);
  expect(rows[0].uncertain).toBe(true);
  expect(rows[0].fields.every((f) => !f.selected)).toBe(true);
});

it('exports only manual changes to imported records, including cleared fields', () => {
  const rows = exportCandidates(
    {
      speakers: [
        {
          id: 's',
          fullName: 'Speaker',
          biographyMd: 'Imported',
          notesMd: '',
          priority: false,
          entryOrigin: 'import',
          manualFields: ['notesMd', 'priority'],
          revision: 3,
          createdBy: 'private-uid'
        }
      ]
    },
    []
  );
  const result = buildEditorialExport(rows);
  expect(result.speakers).toEqual([{ id: 's', fullName: 'Speaker', notesMd: '', priority: false }]);
  expect(result.requiredDocuments).toContainEqual({ collection: 'speakers', id: 's' });
  expect(JSON.stringify(result)).not.toContain('private-uid');
  expect(() => parseImport(JSON.stringify(result))).not.toThrow();
});

it('preserves manually created question status on an explicit editorial restore', () => {
  const rows = exportCandidates(
    {
      questions: [
        {
          id: 'q',
          textIt: 'Domanda',
          status: 'approved',
          entryOrigin: 'manual',
          createdBy: 'private-uid',
          ratings: { another: 5 }
        }
      ]
    },
    []
  );
  const exported = buildEditorialExport(rows);
  const changes = selectedChanges(previewImport(parseImport(JSON.stringify(exported)), {}));
  expect(changes[0].data.status).toBe('approved');
  expect(changes[0].data.ratings).toBeUndefined();
  expect(
    previewImport({ schemaVersion: 1, questions: [{ id: 'q', status: 'approved' }] }, {})[0]
      .incoming.status
  ).toBe('suggested');
});

it('blocks restore patches when the original imported document is missing', () => {
  const rows = exportCandidates(
    {
      speakers: [
        {
          id: 's',
          fullName: 'Speaker',
          notesMd: 'My note',
          entryOrigin: 'import',
          manualFields: ['notesMd']
        }
      ]
    },
    []
  );
  const incoming = parseImport(JSON.stringify(buildEditorialExport(rows)));
  expect(previewImport(incoming, {})[0].blocked).toBe(true);
  const ready = previewImport(incoming, {
    speakers: [{ id: 's', fullName: 'Speaker', notesMd: '' }]
  });
  expect(ready[0].blocked).toBe(false);
  expect(ready[0].fields.every((f) => !f.selected)).toBe(true);
});

it('tracks manual edits and removes imported replacements without trusting incoming provenance', () => {
  const old = {
    id: 's',
    notesMd: 'My note',
    title: 'Original',
    entryOrigin: 'import',
    manualFields: ['notesMd']
  };
  expect(
    trackEditorialFields({ ...old, title: 'Edited', manualFields: ['forged'] }, old, 'manual')
  ).toEqual({ entryOrigin: 'import', manualFields: ['notesMd', 'title'] });
  expect(trackEditorialFields({ ...old, notesMd: 'Imported replacement' }, old, 'import')).toEqual({
    entryOrigin: 'import',
    manualFields: []
  });
});

it('does not export later JSON replacements as manual content', () => {
  const original = { id: 'm', bodyMd: 'My text', entryOrigin: 'manual', manualFields: ['bodyMd'] };
  const imported = { ...original, bodyMd: 'Imported replacement' };
  const saved = { ...imported, ...trackEditorialFields(imported, original, 'import') };
  expect(exportCandidates({ materials: [saved] }, [])).toEqual([]);
});

it('keeps speaker links when exporting only a selected field of a new manual document', () => {
  const rows = exportCandidates(
    { insights: [{ id: 'i', title: 'My thought', speakerIds: ['s'], entryOrigin: 'manual' }] },
    []
  );
  for (const field of rows[0].fields) field.selected = field.key === 'title';
  const result = buildEditorialExport(rows);
  expect(result.insights?.[0].speakerIds).toEqual(['s']);
  expect(result.requiredDocuments).toContainEqual({ collection: 'speakers', id: 's' });
});

it('exports portable personal scores without Firebase user IDs', () => {
  const result = buildEditorialExport([], [{ questionId: 'q', score: 4 }]);
  expect(result.requiredDocuments).toEqual([]);
  expect(parseImport(JSON.stringify(result)).personalRatings).toEqual([
    { questionId: 'q', score: 4 }
  ]);
});

it('exports a schedule alone and includes validation context for partial confirmed slots', () => {
  const rows = exportCandidates(
    {
      interviewSlots: [
        {
          id: 'slot',
          status: 'confirmed',
          chosenStart: '2026-10-28T12:20:00+01:00',
          interviewerId: 'giorgio',
          entryOrigin: 'manual'
        }
      ]
    },
    []
  );
  for (const field of rows[0].fields) field.selected = field.key === 'interviewerId';
  const result = buildEditorialExport(rows);
  expect(() => parseImport(JSON.stringify(result))).not.toThrow();
  expect(result.interviewSlots?.[0]).toEqual({
    id: 'slot',
    status: 'confirmed',
    chosenStart: '2026-10-28T12:20:00+01:00',
    interviewerId: 'giorgio'
  });
});

it('optional votes never block restoration of independent documents', () => {
  const rows = exportCandidates(
    { materials: [{ id: 'm', bodyMd: 'Note', entryOrigin: 'manual' }] },
    []
  );
  const result = buildEditorialExport(rows, [{ questionId: 'missing', score: 5 }]);
  expect(previewImport(parseImport(JSON.stringify(result)), {})[0].blocked).toBe(false);
});
