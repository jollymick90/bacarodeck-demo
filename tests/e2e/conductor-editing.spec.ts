import { test, expect } from '@playwright/test';

test('save notices expire and conductor edits include all question fields without losing metadata', async ({
  page,
  request
}, info) => {
  const id = `conductor-editing-${info.project.name}-${Date.now()}`;
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Conductor editing test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        { collection: 'speakers', data: { id, fullName: 'Conductor editing speaker' } },
        {
          collection: 'questions',
          data: {
            id: `${id}-question`,
            speakerId: id,
            textIt: 'Domanda originale?',
            textEn: 'Original question?',
            followUpIt: 'Approfondimento originale',
            followUpEn: 'Original follow-up',
            whyMd: 'Motivazione originale',
            notesMd: 'Note originali',
            tags: ['originale'],
            sourceIds: [],
            materialIds: [],
            order: 1,
            status: 'suggested'
          }
        }
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  try {
    await page.goto(`/backoffice/contenuti/speakers/${id}`);
    const editor = page.locator('.editor');
    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    await page
      .getByLabel('Nome completo', { exact: true })
      .fill('Conductor editing speaker updated');
    await page.clock.install();
    await editor.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Modifiche salvate.' });
    await expect(notice).toBeVisible();
    await page.clock.fastForward(4100);
    await expect(notice).toHaveCount(0);
    await page.clock.resume();

    await page.goto(`/speaker/${id}?lang=it`);
    await page
      .locator('.question-row')
      .first()
      .getByRole('button', { name: 'Modifica', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Modifica condivisa', exact: true });
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('Domanda aggiornata?');
    await expect(dialog.getByLabel('Follow-up IT', { exact: true })).toHaveCount(0);
    await dialog
      .getByRole('button', { name: 'Mostra tutti i campi editoriali', exact: true })
      .click();
    await dialog.getByLabel('Domanda EN', { exact: true }).fill('Updated question?');
    await dialog.getByLabel('Follow-up IT', { exact: true }).fill('Approfondimento aggiornato');
    await dialog.getByLabel('Follow-up EN', { exact: true }).fill('Updated follow-up');
    await dialog.getByLabel('Motivazione', { exact: true }).fill('Motivazione aggiornata');
    await dialog.getByLabel('Note', { exact: true }).fill('Note aggiornate');
    await dialog.getByLabel('Tag', { exact: true }).fill('ai, verifica');
    await dialog.getByLabel('ID fonti', { exact: true }).fill('source-a, source-b');
    await dialog.getByLabel('ID materiali', { exact: true }).fill('material-a');
    await dialog.getByLabel('Ordine', { exact: true }).fill('2');
    await dialog.getByLabel('Stato', { exact: true }).selectOption('approved');
    await dialog.getByRole('button', { name: 'Salva per tutti', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.question-row').first()).toContainText('Domanda aggiornata?');
    const success = page.getByRole('status').filter({ hasText: 'Domanda aggiornata per tutti.' });
    await expect(success).toBeVisible();
    await success.getByRole('button', { name: 'Chiudi notifica', exact: true }).click();
    await expect(success).toHaveCount(0);
    const saved = (await (await request.get('/api/data/questions', { headers })).json()).find(
      (q: { id: string }) => q.id === `${id}-question`
    );
    expect(saved).toMatchObject({
      speakerId: id,
      textIt: 'Domanda aggiornata?',
      textEn: 'Updated question?',
      followUpIt: 'Approfondimento aggiornato',
      followUpEn: 'Updated follow-up',
      whyMd: 'Motivazione aggiornata',
      notesMd: 'Note aggiornate',
      tags: ['ai', 'verifica'],
      sourceIds: ['source-a', 'source-b'],
      materialIds: ['material-a'],
      order: 2,
      status: 'approved'
    });
    await page
      .locator('.question-row')
      .first()
      .getByRole('button', { name: 'Modifica', exact: true })
      .click();
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('Da annullare');
    await dialog
      .getByRole('button', { name: 'Mostra tutti i campi editoriali', exact: true })
      .click();
    await dialog.getByLabel('Note', { exact: true }).fill('Da annullare');
    await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    await page
      .locator('.question-row')
      .first()
      .getByRole('button', { name: 'Modifica', exact: true })
      .click();
    await expect(dialog.getByLabel('Domanda IT', { exact: true })).toHaveValue(
      'Domanda aggiornata?'
    );
    await dialog
      .getByRole('button', { name: 'Mostra tutti i campi editoriali', exact: true })
      .click();
    await expect(dialog.getByLabel('Note', { exact: true })).toHaveValue('Note aggiornate');
    await page.screenshot({ path: info.outputPath('conductor-full-editor.png') });
    await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    await page
      .locator('.question-row')
      .first()
      .getByRole('button', { name: 'Modifica', exact: true })
      .click();
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('La mia bozza in conflitto');
    const changedByColleague = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'questions',
            data: { ...saved, textIt: 'Domanda del collega?', notesMd: 'Note del collega' },
            expectedRevision: saved.revision
          }
        ]
      }
    });
    expect(changedByColleague.ok(), await changedByColleague.text()).toBe(true);
    await dialog.getByRole('button', { name: 'Salva per tutti', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Conflitto');
    await expect(dialog.getByLabel('Domanda IT', { exact: true })).toHaveValue(
      'La mia bozza in conflitto'
    );
    await expect(page.locator('.question-row').first()).toContainText('Domanda del collega?');
    await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    await page
      .locator('.question-row')
      .first()
      .getByRole('button', { name: 'Modifica', exact: true })
      .click();
    await expect(dialog.getByLabel('Domanda IT', { exact: true })).toHaveValue(
      'Domanda del collega?'
    );
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('Domanda dopo aggiornamento?');
    await dialog.getByRole('button', { name: 'Salva per tutti', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const afterRetry = (await (await request.get('/api/data/questions', { headers })).json()).find(
      (q: { id: string }) => q.id === `${id}-question`
    );
    expect(afterRetry.notesMd).toBe('Note del collega');
    expect(afterRetry.textIt).toBe('Domanda dopo aggiornamento?');
  } finally {
    for (const collection of ['questions', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter(
        (row: { id: string; speakerId?: string }) => row.id === id || row.speakerId === id
      );
      if (records.length)
        expect(
          (
            await request.post('/api/data', {
              headers,
              data: {
                action: 'delete',
                changes: records.map((data: { revision: number }) => ({
                  collection,
                  data,
                  expectedRevision: data.revision
                }))
              }
            })
          ).ok()
        ).toBe(true);
    }
  }
});
