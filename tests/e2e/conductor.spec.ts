import { test, expect } from '@playwright/test';
test('conductor saves interest, uses shared questions and assigns with confirmation', async ({
  page,
  request,
  browser
}, info) => {
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Conduttore');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const token = (await access).headers().authorization;
  const id = 'conductor-' + info.project.name;
  const records = [
    {
      collection: 'speakers',
      data: { id, fullName: 'Speaker mobile ' + info.project.name, tags: ['AI'] }
    },
    {
      collection: 'talks',
      data: {
        id: id + '-talk',
        speakerIds: [id],
        title: 'Valutare gli agenti',
        abstractIt: 'Come verificare un risultato reale.'
      }
    },
    ...[1, 2, 3].map((n) => ({
      collection: 'questions',
      data: {
        id: id + '-q' + n,
        speakerId: id,
        order: n,
        textIt: `Domanda preparata ${n}?`,
        textEn: `Prepared question ${n}?`,
        status: 'suggested'
      }
    }))
  ];
  const result = await request.post('/api/data', {
    headers: { Authorization: token },
    data: { action: 'save', changes: records.map((r) => ({ ...r, expectedRevision: null })) }
  });
  expect(result.ok(), await result.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();
  await page.getByLabel('Cerca speaker').fill('Speaker mobile ' + info.project.name);
  const card = page.locator('[data-speaker="' + id + '"]');
  await card.getByRole('button', { name: 'Mi interessa', exact: true }).first().click();
  await expect(
    page.locator('[aria-label="I miei speaker"]').getByText('Speaker mobile ' + info.project.name)
  ).toBeVisible();
  await page
    .locator('[aria-label="I miei speaker"]')
    .getByRole('button', { name: 'Apri scheda' })
    .click();
  await page.getByRole('button', { name: 'Usa la scaletta', exact: true }).click();
  await expect(page.getByText('Domanda preparata 1?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avanti', exact: true }).click();
  await expect(page.getByText('Domanda preparata 2?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Torna alla scheda' }).click();
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('alberto');
  await page.getByRole('button', { name: 'Conferma assegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Alberto');
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('martin');
  await expect(page.getByRole('dialog')).toContainText('Alberto');
  await page.getByRole('button', { name: 'Conferma riassegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Martin');
  await page
    .locator('.question-row')
    .first()
    .getByRole('button', { name: 'Modifica', exact: true })
    .click();
  await page
    .getByLabel('Testo della domanda', { exact: true })
    .fill('Domanda modificata dal conduttore?');
  await page.getByRole('button', { name: 'Salva per tutti', exact: true }).click();
  await expect(page.locator('.question-row').first()).toContainText(
    'Domanda modificata dal conduttore?'
  );
  await page.getByRole('button', { name: 'Sposta domanda 2 in alto' }).click();
  await expect(page.locator('.question-row').first()).toContainText('Domanda preparata 2?');
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await second.goto('/');
  const secondAccess = second.waitForRequest('**/api/access');
  const secondPopupPromise = second.waitForEvent('popup');
  await second.getByRole('button', { name: 'Accedi con Google' }).click();
  const secondPopup = await secondPopupPromise;
  await expect(secondPopup.locator('.provider-name').first()).toHaveText('Google.com');
  await secondPopup.getByRole('button', { name: 'Add new account' }).click();
  await secondPopup
    .getByLabel('Email')
    .fill(`editor-${info.project.name === 'desktop' ? 'mobile' : 'desktop'}@example.test`);
  await secondPopup.getByLabel('Display name').fill('Altro conduttore');
  await secondPopup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const secondToken = (await secondAccess).headers().authorization;
  const headers = { Authorization: secondToken };
  expect(
    (
      await request.post('/api/conductor/interests', {
        headers,
        data: { speakerId: id, interested: true }
      })
    ).ok()
  ).toBeTruthy();
  expect(
    (
      await request.post('/api/conductor/interests', {
        headers,
        data: { speakerId: id, interested: true }
      })
    ).ok()
  ).toBeTruthy();
  let interests = await (await request.get('/api/data/speakerInterests', { headers })).json();
  expect(interests.filter((i: { speakerId: string }) => i.speakerId === id)).toHaveLength(2);
  expect(
    (
      await request.post('/api/conductor/interests', {
        headers,
        data: { speakerId: id, interested: false }
      })
    ).ok()
  ).toBeTruthy();
  interests = await (await request.get('/api/data/speakerInterests', { headers })).json();
  expect(interests.filter((i: { speakerId: string }) => i.speakerId === id)).toHaveLength(1);
  const remainingInterest = interests.find((i: { speakerId: string }) => i.speakerId === id);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'delete',
          changes: [
            {
              collection: 'speakerInterests',
              data: remainingInterest,
              expectedRevision: remainingInterest.revision
            }
          ]
        }
      })
    ).status()
  ).toBe(400);
  const sharedQuestions = await (await request.get('/api/data/questions', { headers })).json();
  expect(sharedQuestions.find((q: { id: string }) => q.id === id + '-q1').textIt).toBe(
    'Domanda modificata dal conduttore?'
  );
  expect(sharedQuestions.find((q: { id: string }) => q.id === id + '-q1').textEn).toBe(
    'Prepared question 1?'
  );
  expect(
    (
      await request.post('/api/conductor/interests', {
        headers,
        data: { speakerId: id, interested: true, memberUid: 'other' }
      })
    ).status()
  ).toBe(400);
  expect(
    (
      await request.post('/api/conductor/assignment', {
        headers,
        data: {
          speakerId: id,
          teamId: 'giorgio',
          expectedOwner: 'alberto',
          expectedPlanRevision: null,
          confirmReplacement: true
        }
      })
    ).status()
  ).toBe(409);
  await secondContext.close();
  await page.screenshot({ path: info.outputPath('conductor-mobile.png'), fullPage: true });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  ).toBeTruthy();
  expect(
    (
      await request.post('/api/conductor/interests', {
        headers: { Authorization: token },
        data: { speakerId: id, interested: false }
      })
    ).ok()
  ).toBeTruthy();
  const cleanup = [];
  for (const collection of [
    'speakers',
    'talks',
    'questions',
    'interviewPlans',
    'conductorBriefs'
  ]) {
    const items = await (
      await request.get('/api/data/' + collection, { headers: { Authorization: token } })
    ).json();
    for (const item of items.filter(
      (e: { id: string; speakerId?: string; speakerIds?: string[] }) =>
        e.id === id || e.speakerId === id || e.speakerIds?.includes(id)
    )) {
      cleanup.push({ collection, data: item, expectedRevision: item.revision });
    }
  }
  expect(
    (
      await request.post('/api/data', {
        headers: { Authorization: token },
        data: { action: 'delete', changes: cleanup }
      })
    ).ok()
  ).toBeTruthy();
});
