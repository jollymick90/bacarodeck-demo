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
  const abstractIt =
    'Come verificare un risultato reale. '.repeat(30) + 'Conclusione completa italiana.';
  const abstractEn = 'How to verify a real result. '.repeat(30) + 'Complete English conclusion.';
  const records = [
    {
      collection: 'speakers',
      data: {
        id: id + '-outside',
        fullName: 'Speaker fuori elenco ' + info.project.name,
        inInterviewList: false
      }
    },
    {
      collection: 'speakers',
      data: {
        id,
        fullName: 'Speaker mobile ' + info.project.name,
        tags: ['AI'],
        inInterviewList: true
      }
    },
    {
      collection: 'talks',
      data: {
        id: id + '-talk',
        speakerIds: [id],
        title: 'Valutare gli agenti',
        abstractIt,
        abstractEn
      }
    },
    {
      collection: 'talks',
      data: {
        id: id + '-second-talk',
        speakerIds: [id],
        title: 'Una seconda conversazione',
        abstractIt: 'Il secondo talk dello speaker.'
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
        followUpIt: `Approfondimento ${n}?`,
        followUpEn: `Follow-up question ${n}?`,
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
  const outside = page.locator('[data-speaker="' + id + '-outside"]');
  await expect(page.locator('[data-speaker="' + id + '"]')).toBeVisible();
  await expect(outside).toHaveCount(0);
  await page.getByLabel('Cerca speaker').fill('Speaker fuori elenco ' + info.project.name);
  await expect(outside).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostra anche gli altri speaker', exact: true }).click();
  await expect(page).toHaveURL('/?elenco=tutti');
  await expect(outside).toBeVisible();
  await page.reload();
  await expect(outside).toBeVisible();
  await page.getByRole('link', { name: 'Vedi la lista completa', exact: true }).click();
  await expect(page).toHaveURL('/speaker?elenco=tutti');
  await expect(outside).toBeVisible();
  await page.getByRole('button', { name: 'Mostra solo in elenco', exact: true }).click();
  await expect(page).toHaveURL('/speaker');
  await expect(outside).toHaveCount(0);
  await page.reload();
  await expect(outside).toHaveCount(0);
  await page.goto('/');
  await page.getByLabel('Cerca speaker').fill('Speaker mobile ' + info.project.name);
  const card = page.locator('[data-speaker="' + id + '"]');
  await card.getByRole('button', { name: 'Mi interessa', exact: true }).first().click();
  await expect(
    page
      .locator('[aria-label="I miei speaker e i miei assegnati"]')
      .getByText('Speaker mobile ' + info.project.name)
  ).toBeVisible();
  await page
    .locator('[aria-label="I miei speaker e i miei assegnati"]')
    .getByRole('link', { name: 'Apri scheda' })
    .click();
  await expect(page).toHaveURL(new RegExp('/speaker/' + id + '$'));
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Speaker mobile ' + info.project.name })
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/');
  await page.goForward();
  await expect(page).toHaveURL(new RegExp('/speaker/' + id + '$'));
  await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(id + '-second-talk');
  await expect(page).toHaveURL(new RegExp('talk=' + id + '-second-talk'));
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('en');
  await expect(page).toHaveURL(/lang=en/);
  await page.getByRole('link', { name: 'Usa la scaletta', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/speaker/' + id + '/scaletta\\?'));
  await expect(page).toHaveURL(/lang=en/);
  await expect(page).toHaveURL(new RegExp('talk=' + id + '-second-talk'));
  await page.reload();
  await expect(
    page.locator('.interview-question').getByText('Prepared question 1?', { exact: true })
  ).toBeVisible();
  await page.getByRole('link', { name: 'Torna alla scheda' }).click();
  await expect(page.getByRole('combobox', { name: 'Talk', exact: true })).toHaveValue(
    id + '-second-talk'
  );
  await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(id + '-talk');
  await expect(page).toHaveURL(new RegExp('talk=' + id + '-talk'));
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('it');
  await expect(page).toHaveURL(/lang=it/);
  const summary = page.locator('.talk-summary');
  await expect(summary).not.toContainText('Conclusione completa italiana.');
  await summary.getByRole('button', { name: 'Mostra abstract completo', exact: true }).click();
  await expect(summary).toContainText('Conclusione completa italiana.');
  await expect(summary.getByRole('button', { name: 'Mostra meno', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  await summary.getByRole('button', { name: 'Mostra meno', exact: true }).click();
  await expect(summary).not.toContainText('Conclusione completa italiana.');
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('en');
  await summary.getByRole('button', { name: 'Mostra abstract completo', exact: true }).click();
  await expect(summary).toContainText('Complete English conclusion.');
  await page.screenshot({ path: info.outputPath('complete-abstract.png'), fullPage: true });
  await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(id + '-second-talk');
  await expect(summary.getByRole('button', { name: 'Mostra meno', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('it');
  await expect(summary).toContainText('Il secondo talk dello speaker.');
  await expect(
    summary.getByRole('button', { name: 'Mostra abstract completo', exact: true })
  ).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Talk', exact: true }).selectOption(id + '-talk');
  await expect(summary).not.toContainText('Conclusione completa italiana.');
  await page.getByRole('link', { name: 'Usa la scaletta', exact: true }).click();
  await expect(
    page.locator('.interview-question').getByText('Domanda preparata 1?', { exact: true })
  ).toBeVisible();
  await page.getByRole('link', { name: 'Avanti', exact: true }).click();
  await expect(
    page.locator('.interview-question').getByText('Domanda preparata 2?', { exact: true })
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp('question=' + id + '-q2'));
  await page.reload();
  await expect(
    page.locator('.interview-question').getByText('Domanda preparata 2?', { exact: true })
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.locator('.interview-question').getByText('Domanda preparata 1?', { exact: true })
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.locator('.interview-question').getByText('Domanda preparata 2?', { exact: true })
  ).toBeVisible();
  const languageSwitch = page.getByRole('group', { name: 'Lingua domande', exact: true });
  await expect(languageSwitch).toBeVisible();
  await languageSwitch.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(languageSwitch.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(page).toHaveURL(new RegExp('lang=en'));
  await expect(page).toHaveURL(new RegExp('question=' + id + '-q2'));
  await expect(page).toHaveURL(new RegExp('talk=' + id + '-talk'));
  await expect(page.locator('.interview-question')).toContainText('Prepared question 2?');
  await page.getByText('Follow-up', { exact: true }).click();
  await expect(page.getByText('Follow-up question 2?', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.interview-question')).toContainText('Prepared question 2?');
  await languageSwitch.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('lang=it'));
  await expect(page).toHaveURL(new RegExp('question=' + id + '-q2'));
  await expect(page.locator('.interview-question')).toContainText('Domanda preparata 2?');
  await page.getByText('Follow-up', { exact: true }).click();
  await expect(page.getByText('Approfondimento 2?', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Torna alla scheda' }).click();
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('alberto');
  await page.getByRole('button', { name: 'Conferma assegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Alberto');
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('martin');
  await expect(page.getByRole('dialog')).toContainText('Alberto');
  await page.getByRole('button', { name: 'Conferma riassegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Martin');
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('');
  await expect(page.getByRole('dialog')).toContainText('tornerà non assegnato');
  await page.getByRole('button', { name: 'Conferma rimozione assegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Da assegnare');
  await page.reload();
  await expect(page.locator('.assignment-control')).toContainText('Da assegnare');
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('martin');
  await page.getByRole('button', { name: 'Conferma assegnazione' }).click();
  await expect(page.locator('.assignment-control')).toContainText('Martin');
  await page
    .locator('.question-row')
    .first()
    .getByRole('button', { name: 'Modifica', exact: true })
    .click();
  await page.getByLabel('Domanda IT', { exact: true }).fill('Domanda modificata dal conduttore?');
  await page.getByRole('button', { name: 'Salva per tutti', exact: true }).click();
  await expect(page.locator('.question-row').first()).toContainText(
    'Domanda modificata dal conduttore?'
  );
  await page.getByRole('button', { name: 'Sposta domanda 2 in alto' }).click();
  await expect(page.locator('.question-row').first()).toContainText('Domanda preparata 2?');
  await page.getByRole('link', { name: 'Topic', exact: true }).click();
  await expect(page).toHaveURL('/topic');
  await page.getByRole('link', { name: 'AI', exact: true }).click();
  await expect(page).toHaveURL('/topic/AI');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Topic: AI' })).toBeVisible();
  await page.goto('/speaker/missing-speaker');
  await expect(page.getByRole('heading', { name: 'Speaker non trovato' })).toBeVisible();
  await page.goto('/?speaker=' + id + '&talk=' + id + '-talk&lang=en');
  await expect(page).toHaveURL(new RegExp('/speaker/' + id + '\\?talk=' + id + '-talk&lang=en$'));
  await expect(page.getByRole('combobox', { name: 'Lingua', exact: true })).toHaveValue('en');
  await page.getByRole('combobox', { name: 'Lingua', exact: true }).selectOption('it');
  await expect(page).toHaveURL(/lang=it/);
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
        e.id === id || e.id === id + '-outside' || e.speakerId === id || e.speakerIds?.includes(id)
    )) {
      if (collection === 'interviewPlans') {
        expect(
          (
            await request.post('/api/data', {
              headers: { Authorization: token },
              data: {
                action: 'delete',
                changes: [{ collection, data: item, expectedRevision: item.revision }]
              }
            })
          ).status()
        ).toBe(400);
        // Test-only teardown via the isolated demo emulator's administrative REST API.
        const emulator = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        expect(
          (
            await request.delete(
              `http://${emulator}/v1/projects/demo-bacarodeck/databases/(default)/documents/workspaces/codemotion-milano-2026/interviewPlans/${item.id}`,
              { headers: { Authorization: 'Bearer owner' } }
            )
          ).ok()
        ).toBeTruthy();
        continue;
      }
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
