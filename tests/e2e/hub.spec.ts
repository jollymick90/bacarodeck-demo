import { test, expect } from '@playwright/test';
let administratorToken = '';

test('member prepares the five speakers, CRUD and import work on screen', async ({
  page,
  request
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/');
  const accessRequest = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();

  await popup.getByLabel('Email').fill(`editor-${testInfo.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Editor Bacaro');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toBeVisible({
    timeout: 15000
  });
  await expect(page.getByRole('button', { name: 'Aggiungi speaker', exact: true })).toBeEnabled();
  if (await page.getByRole('button', { name: 'Prepara import dei 5 speaker' }).isVisible()) {
    await page.getByRole('button', { name: 'Prepara import dei 5 speaker' }).click();
    await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
    await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
  }
  await page.getByRole('button', { name: /Andrey Breslav/ }).click();
  await expect(page.getByRole('heading', { name: 'Andrey Breslav', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Aggiungi materiale', exact: true }).click();
  await page.getByLabel('Titolo (facoltativo)').fill('Ricerca da Gemini');
  const markdown = '# Appunti da Gemini\n\n' + 'Testo lungo senza metadati. '.repeat(110);
  await page.getByLabel('Testo Markdown').fill(markdown);
  await page.route('**/api/access', (route) => route.abort());
  await page.clock.fastForward(61_000);
  await expect(page.getByLabel('Testo Markdown')).toHaveValue(markdown);
  await page.unroute('**/api/access');

  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByRole('heading', { name: 'Ricerca da Gemini' })).toBeVisible();
  const material = page
    .locator('.content-entry')
    .filter({ has: page.getByRole('heading', { name: 'Ricerca da Gemini' }) });
  await material.getByRole('button', { name: 'Modifica', exact: true }).click();
  await expect(page.getByLabel('Testo Markdown')).toHaveValue(markdown);
  await page.getByLabel('Note', { exact: true }).fill('Verificare con la fonte');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(material.getByText('Verificare con la fonte')).toBeVisible();
  await material.getByRole('button', { name: 'Elimina', exact: true }).click();
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await expect(page.getByRole('heading', { name: 'Ricerca da Gemini' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Fonti', exact: true }).click();
  const source = page
    .locator('.content-entry')
    .filter({ has: page.getByRole('heading', { name: /CSV fornito/ }) });
  await source.getByRole('button', { name: 'Modifica', exact: true }).click();
  await page.getByLabel('URL fonte').fill('https://example.org/codemotion');
  await page.getByLabel('Note', { exact: true }).fill('Fonte verificata dal team');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(source.getByRole('link', { name: 'Apri fonte originale' })).toHaveAttribute(
    'href',
    'https://example.org/codemotion'
  );
  await expect(source.getByText('Fonte verificata dal team')).toBeVisible();
  await page.getByRole('button', { name: 'Prepara intervista' }).click();
  const uid = await page
    .getByLabel('Intervistatore', { exact: true })
    .locator('option')
    .filter({ hasText: 'Editor Bacaro' })
    .last()
    .getAttribute('value');
  await page.getByLabel('Intervistatore', { exact: true }).selectOption(uid!);
  await page.getByLabel('Preparazione', { exact: true }).selectOption('ready');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await page.getByRole('button', { name: 'Intervista', exact: true }).click();
  await expect(page.getByText('Intervistatore: Editor Bacaro')).toBeVisible();
  await page.getByRole('button', { name: 'Domande', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Cosa ti ha insegnato costruire Kotlin/ })
  ).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /What did building Kotlin teach you/ })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/hub-${testInfo.project.name}.png`, fullPage: true });
  await page.reload();
  await page.getByRole('button', { name: /Andrey Breslav/ }).click();
  await expect(page.getByRole('heading', { name: 'Andrey Breslav', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  // Data endpoints independently authorize requests and preserve atomic conflicts.
  const authorization = (await accessRequest).headers().authorization;
  const headers = { Authorization: authorization };
  if (testInfo.project.name === 'desktop') administratorToken = authorization;
  expect((await request.get('/api/data/speakers', { headers })).status()).toBe(200);
  expect((await request.get('/api/data/access', { headers })).status()).toBe(400);
  const accessResponse = await request.get('/api/admin/access', { headers });
  expect(accessResponse.status()).toBe(testInfo.project.name === 'desktop' ? 200 : 403);
  if (testInfo.project.name === 'desktop') {
    expect(
      (
        await request.post('/api/admin/access', {
          headers,
          data: { email: 'new-member@example.test', enabled: true }
        })
      ).status()
    ).toBe(200);
    expect(
      (
        await request.post('/api/admin/access', {
          headers,
          data: { email: 'editor-desktop@example.test', enabled: false }
        })
      ).status()
    ).toBe(400);
  }
  const questions = await (await request.get('/api/data/questions', { headers })).json();
  const question = questions[0];
  expect(
    (
      await request.post(`/api/questions/${question.id}/rating`, {
        headers,
        data: { score: 5, uid: 'forged' }
      })
    ).status()
  ).toBe(200);
  expect(
    (
      await request.post(`/api/questions/${question.id}/rating`, { headers, data: { score: 6 } })
    ).status()
  ).toBe(400);
  const rated = (await (await request.get('/api/data/questions', { headers })).json()).find(
    (q: { id: string }) => q.id === question.id
  );
  expect(rated.ratings.forged).toBeUndefined();
  expect(Object.values(rated.ratings)).toContain(5);
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Torna agli speaker', exact: false }).click();
    await page.getByLabel('Cerca nome, organizzazione o tag').fill('breslav');
    await expect(
      page.getByRole('navigation', { name: 'Scegli speaker' }).getByRole('button')
    ).toHaveCount(1);
    await page.getByRole('button', { name: /Andrey Breslav/ }).click();
    await expect(page.getByRole('heading', { name: 'Andrey Breslav', exact: true })).toBeVisible();
  }

  const temporary = {
    id: `delete-test-${testInfo.project.name}`,
    speakerId: 'andrey-breslav',
    textIt: 'Prova',
    textEn: 'Test',
    status: 'suggested'
  };
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          changes: [{ collection: 'questions', data: temporary, expectedRevision: null }]
        }
      })
    ).status()
  ).toBe(200);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'delete',
          changes: [{ collection: 'questions', data: temporary, expectedRevision: 1 }]
        }
      })
    ).status()
  ).toBe(200);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          changes: [{ collection: 'questions', data: temporary, expectedRevision: null }]
        }
      })
    ).status()
  ).toBe(409);
  await page.getByRole('button', { name: 'Importa tutti gli 84 speaker' }).click();
  await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
  if (await page.getByLabel('Ho verificato le differenze e approvo queste scritture').isVisible()) {
    await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
    const commit = page.getByRole('button', { name: 'Conferma importazione' });
    if (await commit.isEnabled()) await commit.click();
    else await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Torna agli speaker', exact: false }).click();
  const reset = page.getByRole('button', { name: 'Azzera ricerca' });
  if (await reset.isVisible()) await reset.click();
  await expect(
    page.getByRole('navigation', { name: 'Scegli speaker' }).getByRole('button')
  ).toHaveCount(84);
  const nav = page.getByRole('navigation', { name: 'Scegli speaker' });
  await page.getByText('Filtri speaker', { exact: true }).click();
  await page.getByRole('combobox', { name: 'Elenco interviste', exact: true }).selectOption('in');
  await expect(nav.getByRole('button')).toHaveCount(29);
  await page.getByRole('combobox', { name: 'Elenco interviste', exact: true }).selectOption('out');
  await expect(nav.getByRole('button')).toHaveCount(55);
  await page.getByRole('button', { name: 'Azzera ricerca' }).click();
  await expect(nav.getByRole('button')).toHaveCount(84);

  expect(await nav.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `test-results/catalog-${testInfo.project.name}.png` });
  const speakers = await (await request.get('/api/data/speakers', { headers })).json();
  const original = speakers[0];
  const validChange = {
    collection: 'speakers',
    data: { ...original, fullName: 'Must roll back' },
    expectedRevision: original.revision
  };
  const invalidChange = {
    collection: 'materials',
    data: { id: `invalid-${testInfo.project.name}`, bodyMd: 'x'.repeat(201 * 1024) },
    expectedRevision: null
  };
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: { action: 'save', changes: [validChange, invalidChange] }
      })
    ).status()
  ).toBe(400);
  const unchanged = await (await request.get('/api/data/speakers', { headers })).json();
  expect(unchanged.find((item: { id: string }) => item.id === original.id)).toEqual(original);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: { action: 'save', changes: [validChange, validChange] }
      })
    ).status()
  ).toBe(400);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: { action: 'save', changes: [{ ...validChange, collection: 'members' }] }
      })
    ).status()
  ).toBe(400);

  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          changes: [
            {
              collection: 'speakers',
              data: { id: 'andrey-breslav', fullName: 'Changed' },
              expectedRevision: 99999
            }
          ]
        }
      })
    ).status()
  ).toBe(409);
  const migrationSource = (
    await (await request.get('/api/data/speakers', { headers })).json()
  ).find((item: { id: string }) => item.id === 'abiodun-olowode');
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          changes: [
            {
              collection: 'speakers',
              data: {
                ...migrationSource,
                biographyIt: '',
                biographyEn: 'Team translation to preserve',
                translationReviewed: false
              },
              expectedRevision: migrationSource.revision
            }
          ]
        }
      })
    ).status()
  ).toBe(200);
  await page.reload();
  const translations = page.getByRole('button', { name: 'Importa traduzioni IT/EN' });
  await expect(translations).toBeEnabled();
  await translations.click();
  await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
  await page.getByRole('button', { name: 'Seleziona traduzioni mancanti' }).click();
  await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByRole('heading', { name: 'Importa ricerca' })).toHaveCount(0);
  const translated = (await (await request.get('/api/data/speakers', { headers })).json()).find(
    (item: { id: string }) => item.id === 'abiodun-olowode'
  );
  expect(translated.biographyIt.length).toBeGreaterThan(100);
  expect(translated.biographyEn).toBe('Team translation to preserve');
  expect(translated.biographyMd).toBe(migrationSource.biographyMd);
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          changes: [
            {
              collection: 'speakers',
              data: { ...translated, tags: ['Team tag'] },
              expectedRevision: translated.revision
            },
            {
              collection: 'talks',
              data: {
                id: `tag-test-${testInfo.project.name}`,
                speakerIds: ['abiodun-olowode'],
                title: 'AI security'
              },
              expectedRevision: null
            }
          ]
        }
      })
    ).status()
  ).toBe(200);
  await page.reload();
  const updateTags = page.getByRole('button', { name: 'Aggiorna tag', exact: true });
  await expect(updateTags).toBeEnabled();
  await updateTags.click();
  await expect(page.getByRole('button', { name: 'Conferma aggiornamento tag' })).toBeDisabled();
  await page.getByRole('button', { name: 'Seleziona tutti i tag proposti' }).click();
  await page.getByRole('button', { name: 'Conferma aggiornamento tag' }).click();
  await expect(page.getByRole('heading', { name: 'Aggiorna tag speaker' })).toHaveCount(0);
  const tagged = (await (await request.get('/api/data/speakers', { headers })).json()).find(
    (item: { id: string }) => item.id === 'abiodun-olowode'
  );
  expect(tagged.tags).toEqual(expect.arrayContaining(['Team tag', 'AI', 'Sicurezza']));
  await updateTags.click();
  await expect(page.getByText('0 speaker con nuovi tag proposti.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi tag' }).click();
});

test('Google accounts outside ALLOW_LIST cannot open the workspace', async ({ page, request }) => {
  expect((await request.post('/api/access')).status()).toBe(401);
  expect(
    (await request.post('/api/access', { headers: { Authorization: 'Bearer forged' } })).status()
  ).toBe(401);
  expect((await request.get('/api/data/speakers')).status()).toBe(401);
  expect(
    (await request.post('/api/data', { data: { action: 'save', changes: [] } })).status()
  ).toBe(401);
  await page.goto('/');
  const deniedRequest = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill('outsider@example.test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accesso non abilitato' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Andrey Breslav/ })).toHaveCount(0);
  const headers = { Authorization: (await deniedRequest).headers().authorization };
  expect((await request.get('/api/data/speakers', { headers })).status()).toBe(403);
  expect((await request.post('/api/data', { headers, data: {} })).status()).toBe(403);
  if (administratorToken) {
    const adminHeaders = { Authorization: administratorToken };
    expect(
      (
        await request.post('/api/admin/access', {
          headers: adminHeaders,
          data: { email: 'outsider@example.test', enabled: true }
        })
      ).status()
    ).toBe(200);
    expect((await request.get('/api/data/speakers', { headers })).status()).toBe(200);
    expect(
      (
        await request.post('/api/admin/access', {
          headers: adminHeaders,
          data: { email: 'outsider@example.test', enabled: false }
        })
      ).status()
    ).toBe(200);
    expect((await request.get('/api/data/speakers', { headers })).status()).toBe(403);
  }
});
