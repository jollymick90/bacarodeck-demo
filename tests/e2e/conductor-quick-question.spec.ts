import { test, expect } from '@playwright/test';

test('conductor creates questions from the speaker sheet and preserves the shared closing question', async ({
  page,
  request
}, info) => {
  const id = `quick-question-${info.project.name}-${Date.now()}`;
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Quick question test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        { collection: 'speakers', data: { id, fullName: 'Quick question speaker' } },
        { collection: 'speakers', data: { id: `${id}-empty`, fullName: 'Empty speaker' } },
        {
          collection: 'talks',
          data: { id: `${id}-talk`, title: 'Selected talk', speakerIds: [id] }
        },
        ...['opening', 'closing', 'optional'].map((suffix) => ({
          collection: 'questions',
          data: {
            id: `${id}-${suffix}`,
            speakerId: id,
            textEn: `${suffix} question?`,
            status: 'approved'
          }
        })),
        {
          collection: 'conductorBriefs',
          data: {
            id: `${id}-brief`,
            speakerId: id,
            talkId: `${id}-talk`,
            mainQuestionIds: [`${id}-opening`, `${id}-closing`],
            optionalQuestionIds: [`${id}-optional`],
            classicQuestionIds: [`${id}-closing`],
            summaryEn: 'Shared editorial summary'
          }
        }
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  const questions = async () =>
    (await (await request.get('/api/data/questions', { headers })).json()).filter(
      (q: { speakerId: string }) => q.speakerId === id
    );
  try {
    const url = `/speaker/${id}?lang=en&talk=${id}-talk`;
    await page.goto(url);
    const add = page.getByRole('button', { name: 'Aggiungi domanda', exact: true });
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Aggiungi domanda', exact: true });
    await expect(dialog.getByLabel('Domanda EN', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('conductor-quick-question.png') });
    await dialog.getByLabel('Domanda EN', { exact: true }).fill('Discarded question');
    await dialog.getByRole('button', { name: 'Annulla', exact: true }).click();
    expect(await questions()).toHaveLength(3);
    await add.click();
    await expect(dialog.getByLabel('Domanda EN', { exact: true })).toHaveValue('');
    await dialog.getByRole('button', { name: 'Aggiungi alla scaletta', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Scrivi il testo');
    await dialog.getByLabel('Domanda EN', { exact: true }).fill('My quick English question?');
    await dialog
      .getByRole('button', { name: 'Mostra tutti i campi editoriali', exact: true })
      .click();
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('La mia domanda veloce?');
    await dialog.getByLabel('Follow-up EN', { exact: true }).fill('A quick follow-up');

    // A colleague changes the lineup while the draft is open: neither write may succeed.
    const brief = (await (await request.get('/api/data/conductorBriefs', { headers })).json()).find(
      (b: { id: string }) => b.id === `${id}-brief`
    );
    const colleague = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'conductorBriefs',
            data: { ...brief, summaryEn: 'Colleague summary' },
            expectedRevision: brief.revision
          }
        ]
      }
    });
    expect(colleague.ok(), await colleague.text()).toBe(true);
    await dialog.getByRole('button', { name: 'Aggiungi alla scaletta', exact: true }).click();
    await expect(dialog.getByRole('alert').filter({ hasText: 'Conflitto' })).toBeVisible();
    await expect(dialog.getByLabel('Domanda EN', { exact: true })).toHaveValue(
      'My quick English question?'
    );
    expect(await questions()).toHaveLength(3);
    await expect(page.locator('.talk-summary')).toContainText('Colleague summary');
    await dialog
      .getByRole('button', { name: 'Aggiorna scaletta e mantieni la domanda', exact: true })
      .click();
    await expect(dialog.getByRole('status')).toContainText('Scaletta aggiornata');
    await expect(dialog.getByLabel('Domanda EN', { exact: true })).toHaveValue(
      'My quick English question?'
    );
    await expect(dialog.getByLabel('Domanda IT', { exact: true })).toHaveValue(
      'La mia domanda veloce?'
    );
    await expect(dialog.getByLabel('Follow-up EN', { exact: true })).toHaveValue(
      'A quick follow-up'
    );
    await dialog.getByRole('button', { name: 'Aggiungi alla scaletta', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(url.replace('?', '\\?') + '$'));
    await expect(page.locator('.question-row')).toHaveCount(3);
    await expect(page.locator('.question-row').nth(1)).toContainText('My quick English question?');
    await expect(page.locator('.question-row').last()).toContainText('closing question?');
    const saved = (await questions()).find(
      (q: { textEn: string }) => q.textEn === 'My quick English question?'
    );
    expect(saved).toMatchObject({
      speakerId: id,
      textIt: 'La mia domanda veloce?',
      followUpEn: 'A quick follow-up'
    });
    expect(await questions()).toHaveLength(4);
    const updated = (
      await (await request.get('/api/data/conductorBriefs', { headers })).json()
    ).find((b: { id: string }) => b.id === brief.id);
    expect(updated).toMatchObject({
      talkId: `${id}-talk`,
      mainQuestionIds: [`${id}-opening`, saved.id, `${id}-closing`],
      optionalQuestionIds: [`${id}-optional`],
      classicQuestionIds: [`${id}-closing`],
      summaryEn: 'Colleague summary'
    });
    await page.reload();
    await expect(page.locator('.question-row').nth(1)).toContainText('My quick English question?');

    // The first question also works for a speaker without a talk or an existing brief.
    await page.goto(`/speaker/${id}-empty?lang=it`);
    await page.getByRole('button', { name: 'Scegli una domanda', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Scegli una domanda', exact: true })
      .getByRole('button', { name: 'Scrivi una nuova domanda', exact: true })
      .click();
    await dialog.getByLabel('Domanda IT', { exact: true }).fill('Prima domanda senza talk?');
    await dialog.getByRole('button', { name: 'Aggiungi alla scaletta', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.locator('.question-row')).toHaveCount(1);
    await expect(page.locator('.question-row')).toContainText('Prima domanda senza talk?');
  } finally {
    for (const collection of ['conductorBriefs', 'questions', 'talks', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter(
        (r: { id: string; speakerId?: string }) =>
          r.id.startsWith(id) || r.speakerId?.startsWith(id)
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
