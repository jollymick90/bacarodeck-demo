import { test, expect } from '@playwright/test';

test('all four opening suggestions follow the interview language and leave the speaker questions in place', async ({
  page,
  request
}, info) => {
  const id = `icebreakers-${info.project.name}-${Date.now()}`;
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Viewport fallback'));
  });
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Icebreakers test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        { collection: 'speakers', data: { id, fullName: 'Icebreaker speaker' } },
        { collection: 'speakers', data: { id: `${id}-other`, fullName: 'Another speaker' } },
        ...[1, 2].map((n) => ({
          collection: 'questions',
          data: {
            id: `${id}-q${n}`,
            speakerId: id,
            textIt: `Domanda speaker ${n}?`,
            textEn: `Speaker question ${n}?`,
            order: n
          }
        })),
        {
          collection: 'questions',
          data: { id: `${id}-other-q`, speakerId: `${id}-other`, textIt: 'Altro speaker?' }
        }
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  try {
    await page.goto(`/speaker/${id}/intervista?lang=it`);
    const viewer = page.getByRole('region', { name: 'Modalità intervista', exact: true });
    await expect(viewer).toContainText('Domanda speaker 1?');
    await viewer.getByRole('button', { name: 'Suggerisci domanda di inizio', exact: true }).click();
    const italian = viewer.getByRole('region', { name: 'Domande di inizio', exact: true });
    await expect(italian.locator('li')).toHaveText([
      'Puoi raccontarci qualcosa del tuo talk?',
      "Qual è l'idea principale del tuo intervento?",
      'Cosa ti ha spinto a scegliere questo argomento?',
      'Cosa vorresti che gli sviluppatori si portassero a casa dal tuo intervento?'
    ]);
    await expect(
      viewer.getByRole('button', { name: 'Prossima domanda', exact: true })
    ).toBeDisabled();
    await page.keyboard.press('ArrowRight');
    await expect(italian).toBeVisible();
    await viewer.getByRole('button', { name: 'EN', exact: true }).click();
    const english = viewer.getByRole('region', { name: 'Start questions', exact: true });
    await expect(english.locator('li')).toHaveText([
      'Can you tell us a little about your talk?',
      "What's the main idea behind your talk?",
      'What inspired you to talk about this topic?',
      'What do you want developers to take away from your talk?'
    ]);
    await expect(italian).toHaveCount(0);
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 390 });
    await expect(
      viewer.getByRole('button', { name: 'Back to interview', exact: true })
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath('start-questions.png') });
    await viewer.getByRole('button', { name: 'Back to interview', exact: true }).click();
    await expect(english).toHaveCount(0);
    await expect(viewer).toContainText('Speaker question 1?');
    await viewer.getByRole('button', { name: 'Suggest start question', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(viewer).toBeVisible();
    await expect(english).toHaveCount(0);
    await expect(viewer).toContainText('Speaker question 1?');
    await viewer.getByRole('button', { name: 'Prossima domanda', exact: true }).click();
    await expect(viewer).toContainText('Speaker question 2?');
    await expect(
      viewer.getByRole('button', { name: 'Prossima domanda', exact: true })
    ).toBeDisabled();
    const questions = (await (await request.get('/api/data/questions', { headers })).json()).filter(
      (q: { speakerId: string }) => q.speakerId === id
    );
    expect(questions).toHaveLength(2);
    expect(questions.every((q: { revision: number }) => q.revision === 1)).toBe(true);
    await page.goto(`/speaker/${id}-other/intervista?lang=en`);
    await viewer.getByRole('button', { name: 'Suggest start question', exact: true }).click();
    await expect(english.locator('li')).toHaveCount(4);
    await expect(english.locator('li').first()).toHaveText(
      'Can you tell us a little about your talk?'
    );
  } finally {
    for (const collection of ['questions', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter((r: { id: string }) => r.id.startsWith(id));
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
