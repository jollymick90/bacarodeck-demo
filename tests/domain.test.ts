import { describe, it, expect } from 'vitest';
import {
  validateEntity,
  prepareWrite,
  parseImport,
  previewImport,
  selectedChanges,
  renderMarkdown
} from '../src/lib/domain';
import seed from '../data/seed/seed_five.json';

describe('editorial validation and audit', () => {
  it('accepts plain pasted Markdown without classification and preserves whitespace', () => {
    const bodyMd = '  # Ricerca\n\n' + 'contenuto '.repeat(350);
    expect(validateEntity('materials', { id: 'm', bodyMd })).toEqual([]);
    expect(prepareWrite('materials', { id: 'm', bodyMd }, null, 'alice', 123).bodyMd).toBe(bodyMd);
  });
  it('rejects oversize UTF-8 without silently truncating', () => {
    expect(validateEntity('materials', { id: 'm', bodyMd: 'è'.repeat(102401) }).join()).toContain(
      '200 KiB'
    );
  });
  it('rejects contacts and unsafe URLs, including nested data', () => {
    expect(
      validateEntity('speakers', { id: 's', fullName: 'Name', email: 'private@example.com' }).length
    ).toBeGreaterThan(0);
    expect(
      validateEntity('sources', { id: 's', url: 'javascript:alert(1)' }).length
    ).toBeGreaterThan(0);
    expect(
      validateEntity('speakers', { id: 's', fullName: 'N', publicLinks: [{ email: 'a@b.it' }] })
        .length
    ).toBeGreaterThan(0);
  });
  it('preserves creation metadata and increments revision on update', () => {
    const old = {
      id: 's',
      fullName: 'N',
      createdAt: 1,
      createdBy: 'alice',
      updatedAt: 1,
      updatedBy: 'alice',
      revision: 2
    };
    expect(
      prepareWrite('speakers', { ...old, fullName: 'New', createdBy: 'mallory' }, old, 'bob', 42)
    ).toMatchObject({
      createdAt: 1,
      createdBy: 'alice',
      updatedAt: 42,
      updatedBy: 'bob',
      revision: 3,
      fullName: 'New'
    });
  });
  it('rejects changed IDs and stale revisions', () => {
    const old = { id: 's', fullName: 'N', revision: 2 };
    expect(() => prepareWrite('speakers', { ...old, revision: 1 }, old, 'a', 1)).toThrow(
      /conflitto/i
    );
    expect(() => prepareWrite('speakers', { ...old, id: 'x' }, old, 'a', 1)).toThrow(/ID/);
  });
  it('sanitizes scripts, event handlers and javascript links', () => {
    const html = renderMarkdown(
      '# Titolo\n\n<script>alert(1)</script><img src=x onerror=alert(1)>[link](javascript:alert(1))'
    );
    expect(html).toContain('<h1>Titolo</h1>');
    expect(html).not.toMatch(/<script|onerror|href="javascript:/);
  });
});

describe('explicit import', () => {
  it('accepts exactly the five-speaker seed', () => {
    expect(parseImport(JSON.stringify(seed)).speakers).toHaveLength(5);
  });
  it('explains invalid schema, contacts and duplicate technical IDs', () => {
    expect(() => parseImport('{')).toThrow(/JSON/);
    expect(() =>
      parseImport(
        JSON.stringify({ schemaVersion: 1, speakers: [{ id: 'x', fullName: 'N', phone: '1' }] })
      )
    ).toThrow();
    expect(() =>
      parseImport(
        JSON.stringify({
          schemaVersion: 1,
          speakers: [
            { id: 'x', fullName: 'N' },
            { id: 'x', fullName: 'N' }
          ]
        })
      )
    ).toThrow(/duplicat/i);
  });
  it('defaults existing field changes to unselected and protects approved questions', () => {
    const existing = {
      speakers: [{ id: 's', fullName: 'Old', revision: 3 }],
      questions: [{ id: 'q', speakerId: 's', textIt: 'Approved', status: 'approved', revision: 2 }]
    };
    const input = parseImport(
      JSON.stringify({
        schemaVersion: 1,
        speakers: [{ id: 's', fullName: 'New' }],
        questions: [{ id: 'q', speakerId: 's', textIt: 'AI', status: 'approved' }]
      })
    );
    const rows = previewImport(input, existing);
    expect(rows[0].fields.find((f) => f.key === 'fullName')?.selected).toBe(false);
    expect(rows.find((r) => r.collection === 'questions')?.blocked).toBeTruthy();
    expect(selectedChanges(rows)).toHaveLength(0);
  });
  it('forces imported AI questions to suggested and warns about names and source URLs', () => {
    const input = parseImport(
      JSON.stringify({
        schemaVersion: 1,
        speakers: [{ id: 'new', fullName: 'Àda  Lovelace' }],
        sources: [{ id: 'new-source', url: 'https://example.com/' }],
        questions: [{ id: 'new-q', speakerId: 'new', textIt: 'Perché?', status: 'approved' }]
      })
    );
    const rows = previewImport(input, {
      speakers: [{ id: 'old', fullName: 'Ada Lovelace' }],
      sources: [{ id: 'old-source', url: 'https://example.com' }]
    });
    expect(rows.find((r) => r.collection === 'speakers')?.warnings.length).toBeGreaterThan(0);
    expect(rows.find((r) => r.collection === 'sources')?.warnings.length).toBeGreaterThan(0);
    expect(selectedChanges(rows).find((r) => r.collection === 'questions')?.data.status).toBe(
      'suggested'
    );
  });
  it('matches targetSpeakerId without merging people by name', () => {
    const input = parseImport(
      JSON.stringify({
        schemaVersion: 1,
        targetSpeakerId: 'existing',
        speakers: [{ id: 'incoming', fullName: 'Name' }],
        questions: [{ id: 'q', speakerId: 'incoming', textIt: '?' }]
      })
    );
    const rows = previewImport(input, {
      speakers: [{ id: 'existing', fullName: 'Name', revision: 1 }]
    });
    expect(rows.find((r) => r.collection === 'speakers')?.id).toBe('existing');
    expect(rows.find((r) => r.collection === 'questions')?.incoming.speakerId).toBe('existing');
  });
});

describe('review regressions', () => {
  it('allows insight creation and import with a technical ID', () => {
    expect(validateEntity('insights', { id: 'insight', bodyMd: 'Interpretazione' })).toEqual([]);
    expect(
      parseImport(
        JSON.stringify({
          schemaVersion: 1,
          insights: [{ id: 'insight', bodyMd: 'Interpretazione' }]
        })
      ).insights
    ).toHaveLength(1);
  });
  it('targets standalone research consistently and refuses ambiguous multi-person imports', () => {
    const input = parseImport(
      JSON.stringify({
        schemaVersion: 1,
        targetSpeakerId: 'existing',
        materials: [{ id: 'm', speakerIds: ['incoming'], bodyMd: 'research' }]
      })
    );
    expect(
      previewImport(input, { speakers: [{ id: 'existing', fullName: 'Target' }] })[0].incoming
        .speakerIds
    ).toEqual(['existing']);
    expect(() =>
      parseImport(
        JSON.stringify({
          schemaVersion: 1,
          targetSpeakerId: 'existing',
          materials: [{ id: 'm', speakerIds: ['one', 'two'] }]
        })
      )
    ).toThrow(/ambigu/i);
  });
});

describe('editorial defaults', () => {
  it('does not label unclassified AI research as a reported fact', async () => {
    const { provenanceLabel } = await import('../src/lib/domain');
    expect(provenanceLabel('materials', { id: 'm', bodyMd: 'AI text' })).toBe(
      'Provenienza non classificata · da verificare'
    );
    expect(provenanceLabel('materials', { id: 'm', provenance: 'ai_generated' })).toBe(
      'Testo AI · da verificare'
    );
  });
  it('uses the speaker ID for its single interview plan', async () => {
    const { emptyEntity } = await import('../src/lib/fields');
    expect(emptyEntity('interviewPlans', 'andrey-breslav').id).toBe('andrey-breslav');
  });
});

it('warns about duplicate names and URLs within the same incoming file', () => {
  const input = parseImport(
    JSON.stringify({
      schemaVersion: 1,
      speakers: [
        { id: 'a', fullName: 'Ada' },
        { id: 'b', fullName: 'Ada' }
      ],
      sources: [
        { id: 'a', url: 'https://example.org/' },
        { id: 'b', url: 'https://example.org' }
      ]
    })
  );
  const rows = previewImport(input, {});
  expect(rows.filter((r) => r.warnings.length)).toHaveLength(4);
});

it('preserves interview language choices through import and accepts older plans', () => {
  for (const interviewLanguage of [
    'language_pending',
    'italian',
    'english_possible',
    'english_confirmed'
  ]) {
    const plan = { id: 'plan', speakerId: 'speaker', interviewLanguage };
    expect(validateEntity('interviewPlans', plan)).toEqual([]);
    const imported = parseImport(JSON.stringify({ schemaVersion: 1, interviewPlans: [plan] }));
    expect(imported.interviewPlans?.[0].interviewLanguage).toBe(interviewLanguage);
  }
  expect(validateEntity('interviewPlans', { id: 'legacy', speakerId: 'speaker' })).toEqual([]);
  expect(
    validateEntity('interviewPlans', { id: 'invalid', interviewLanguage: 'wrong' }).length
  ).toBeGreaterThan(0);
});
