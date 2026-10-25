import { test, expect } from '@playwright/test';
import { briefId } from '../../src/lib/conductor/brief';

test('info is separate and interview questions follow the shared talk selection', async ({
  page,
  request
}, info) => {
  const id = `interview-workspace-${info.project.name}-${Date.now()}`;
  await page.goto('/backoffice');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Interview editor');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const talkId = id + '-talk';
  const secondTalk = id + '-other';
  const mainBrief = briefId(id, talkId);
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: {
            id,
            fullName: 'Interview speaker',
            biographyIt: 'Biografia riservata alla tab Info.'
          }
        },
        { collection: 'talks', data: { id: talkId, title: 'First talk', speakerIds: [id] } },
        { collection: 'talks', data: { id: secondTalk, title: 'Second talk', speakerIds: [id] } },
        ...[1, 2, 3, 4].map((n) => ({
          collection: 'questions',
          data: {
            id: `${id}-q${n}`,
            speakerId: id,
            textIt: `Domanda ${n}`,
            textEn: `Question ${n}`,
            order: n,
            status: 'suggested'
          }
        }))
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  for (const [talk, ids] of [
    [talkId, [id + '-q3', id + '-q1']],
    [secondTalk, []]
  ] as const) {
    const result = await request.post('/api/conductor/brief', {
      headers,
      data: {
        brief: {
          id: briefId(id, talk),
          speakerId: id,
          talkId: talk,
          mainQuestionIds: ids,
          classicQuestionIds: [id + '-q2'],
          summaryIt: 'Sintesi da preservare'
        },
        expectedRevision: null
      }
    });
    expect(result.ok(), await result.text()).toBe(true);
  }
  try {
    await page.goto(`/backoffice/speaker/${id}`);
    await expect(
      page.getByText('Biografia riservata alla tab Info.', { exact: true })
    ).toBeVisible();
    await expect(page.locator('.assignment-control')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Contenuti dello speaker' }).getByRole('link')
    ).toHaveText(['Info', 'Note', 'Intervista', 'Strumenti']);
    await page.getByRole('link', { name: 'Note', exact: true }).click();
    await expect(page.locator('.research-assistant')).toHaveCount(0);
    await expect(page.locator('.assignment-control')).toHaveCount(0);
    await expect(page.getByText('Biografia riservata alla tab Info.', { exact: true })).toHaveCount(
      0
    );
    await page.goto(`/backoffice/speaker/${id}/domande?talk=${talkId}`);
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/intervista?talk=${talkId}`);
    const selected = page.getByRole('region', { name: 'Domande per intervista', exact: true });
    const others = page.getByRole('region', { name: 'Altre domande', exact: true });
    await expect(selected.locator('article h3')).toHaveText(['Domanda 3', 'Domanda 1']);
    await expect(others.locator('article h3')).toHaveText(['Domanda 2', 'Domanda 4']);
    await expect(page.locator('.assignment-control')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ordina per voto' }).click();
    await expect(selected.locator('article h3')).toHaveText(['Domanda 3', 'Domanda 1']);
    await others
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Domanda 4', exact: true }) })
      .getByRole('button', { name: 'Usa per intervista' })
      .click();
    await expect(selected.locator('article h3')).toHaveText([
      'Domanda 3',
      'Domanda 1',
      'Domanda 4'
    ]);
    await expect(others.getByRole('button', { name: 'Usa per intervista' })).toBeDisabled();
    await selected
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Domanda 1', exact: true }) })
      .getByRole('button', { name: 'Togli dall’intervista' })
      .click();
    await expect(selected.locator('article h3')).toHaveText(['Domanda 3', 'Domanda 4']);
    await page.getByRole('button', { name: 'Sposta domanda 2 in alto' }).click();
    await expect(selected.locator('article h3')).toHaveText(['Domanda 4', 'Domanda 3']);
    await page.reload();
    await expect(selected.locator('article h3')).toHaveText(['Domanda 4', 'Domanda 3']);
    await page.screenshot({ path: info.outputPath('interview-selection.png'), fullPage: true });
    const saved = (await (await request.get('/api/data/conductorBriefs', { headers })).json()).find(
      (row: { id: string }) => row.id === mainBrief
    );
    expect(saved.classicQuestionIds).toEqual([id + '-q2']);
    expect(saved.summaryIt).toBe('Sintesi da preservare');
    await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(secondTalk);
    await expect(selected.locator('article')).toHaveCount(0);
    await expect(others.locator('article')).toHaveCount(4);
    await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(talkId);
    await expect(selected.locator('article h3')).toHaveText(['Domanda 4', 'Domanda 3']);
    await expect(
      page.getByRole('link', { name: 'Apri scaletta conduttore', exact: true })
    ).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(secondTalk);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    const interviewUrl = page.url();
    await page.getByRole('link', { name: 'Prepara domande con AI', exact: true }).click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/strumenti?prompt=domande`);
    await expect(page.locator('.prompt-group').nth(1)).toHaveAttribute('open');
    await expect(
      page.getByText('Scaletta: una domanda sul talk, una sull’AI e una che collega i due temi.', {
        exact: true
      })
    ).toBeVisible();
    await page.goto(`/backoffice/importa/domande?speaker=${id}`);
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/strumenti?prompt=domande`);
    await expect(page.locator('.prompt-group').nth(1)).toHaveAttribute('open');
    await page.goto(interviewUrl);
    const addQuestion = page.getByRole('link', { name: 'Aggiungi domanda', exact: true });
    await expect(addQuestion).toHaveCount(1);
    await addQuestion.click();
    const editor = page.locator('.editor');
    await expect(editor.getByRole('heading', { name: 'Domanda', exact: true })).toBeVisible();
    await expect(page.locator('.speaker-profile')).toContainText('Interview speaker');
    await expect(page.locator('.speaker-photo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toHaveCount(0);
    await expect(editor.locator('.editor-actions').getByRole('button')).toHaveText([
      'Salva',
      'Annulla'
    ]);
    await expect(editor.locator('.form-actions')).toHaveCount(0);
    await page.getByLabel('Domanda IT', { exact: true }).fill('Nuova domanda per intervista');
    await page.getByLabel('Domanda EN', { exact: true }).fill('New interview question');
    await editor.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page).toHaveURL(/\/backoffice\/contenuti\/questions\//);
    await expect(editor).toHaveAttribute('aria-label', 'Lettura contenuto');
    await expect(page.getByRole('status')).toContainText('Domanda salvata.');
    const questionUrl = page.url();
    expect(new URL(questionUrl).searchParams.get('talk')).toBe(secondTalk);
    expect(new URL(questionUrl).searchParams.get('lang')).toBe('en');
    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    await page.getByLabel('Domanda IT', { exact: true }).fill('Modifica da annullare');
    await editor.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(page).toHaveURL(questionUrl);
    await expect(editor).toHaveAttribute('aria-label', 'Lettura contenuto');
    await expect(editor).toContainText('Nuova domanda per intervista');
    await expect(editor).not.toContainText('Modifica da annullare');
    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    await page.getByLabel('Domanda EN', { exact: true }).fill('Updated interview question');
    await editor.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(editor.getByRole('status')).toHaveText('Domanda salvata.');
    await expect(page).toHaveURL(questionUrl);
    await page.reload();
    await expect(editor).toContainText('Updated interview question');
    await editor.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/intervista?talk=${secondTalk}&lang=en`);
    await expect(
      others.getByRole('heading', { name: 'Updated interview question', exact: true })
    ).toBeVisible();
    await page.goto(`/speaker/${id}/scaletta?talk=${talkId}&lang=it`);
    await expect(page).toHaveURL(new RegExp(`/speaker/${id}/scaletta\\?`));
    await expect(page.locator('.interview-question')).toContainText('Domanda 4');
  } finally {
    for (const collection of ['conductorBriefs', 'questions', 'talks', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter(
        (row: { id: string; speakerId?: string; speakerIds?: string[] }) =>
          row.id === id || row.speakerId === id || row.speakerIds?.includes(id)
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
