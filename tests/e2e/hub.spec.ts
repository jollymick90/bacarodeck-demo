import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
let administratorToken = '';

test('member prepares the five speakers, CRUD and import work on screen', async ({
  page,
  request
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto('/backoffice');
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
  if (!(await page.getByRole('button', { name: /Andrey Breslav/ }).isVisible())) {
    if (await page.getByRole('button', { name: 'Prepara import dei 5 speaker' }).isVisible()) {
      await page.getByRole('button', { name: 'Prepara import dei 5 speaker' }).click();
    } else {
      await page.getByRole('button', { name: 'Importa JSON', exact: true }).click();
      await page
        .getByLabel('JSON da importare')
        .fill(await readFile(new URL('../../data/seed/seed_five.json', import.meta.url), 'utf8'));
    }
    await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
    await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
  }
  await page.getByRole('button', { name: /Andrey Breslav/ }).click();
  await expect(page.getByRole('heading', { name: 'Andrey Breslav', exact: true })).toBeVisible();
  const assistant = page.locator('.research-assistant');
  await assistant.locator('summary').click();
  await assistant.getByRole('button', { name: 'Copia prompt ricerca', exact: true }).click();
  await expect(assistant.getByLabel(/Prompt pronto/)).toHaveValue(/Andrey Breslav/);
  await expect(
    assistant.getByRole('button', { name: 'Copia prompt domande', exact: true })
  ).toBeDisabled();
  await assistant.locator('.choices input').first().check();
  await assistant.getByRole('button', { name: 'Copia prompt domande', exact: true }).click();
  await expect(assistant.getByLabel(/Prompt pronto/)).toHaveValue(/RICERCA SELEZIONATA/);
  await assistant
    .getByLabel('Oppure incolla il risultato Markdown')
    .fill(
      '# Ricerca AI incollata\n\n**IT:** Idee. **EN:** Ideas.\n\n# Seconda fonte\n\n`[Originale](https://example.com)`'
    );
  await assistant.getByRole('button', { name: 'Aggiungi all’anteprima' }).click();
  const reader = assistant.locator('.research-reader');
  await expect(reader.locator('details').nth(1)).not.toHaveAttribute('open');
  await reader.getByRole('combobox').selectOption('1');
  await expect(reader.getByRole('link', { name: 'Originale' })).toBeVisible();
  await expect(reader.getByRole('link', { name: 'Originale' })).toHaveAttribute(
    'href',
    'https://example.com'
  );
  await reader.getByRole('button', { name: 'Chiudi tutto' }).click();
  await expect(reader.locator('details[open]')).toHaveCount(0);
  await reader.getByRole('button', { name: 'Apri tutto' }).click();
  await expect(reader.locator('details[open]')).toHaveCount(2);
  await assistant.getByLabel('Carica uno o più file .md').setInputFiles({
    name: 'ricerca.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Ricerca AI da file\n\nAppunti dal file.')
  });
  await assistant.getByRole('button', { name: 'Conferma e salva 2 contenuti' }).click();
  for (const title of ['Ricerca AI incollata', 'Ricerca AI da file']) {
    const entry = page
      .locator('.content-entry')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
    await expect(entry).toBeVisible();
    await entry.getByRole('button', { name: 'Elimina', exact: true }).click();
    await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await expect(entry).toHaveCount(0);
  }
  await page.getByRole('button', { name: '+ Aggiungi ricerca', exact: true }).click();
  await page.getByLabel('Titolo (facoltativo)').fill('Ricerca da Gemini');
  const markdown = '# Appunti da Gemini\n\n' + 'Testo lungo senza metadati. '.repeat(110);
  await page.getByLabel('Testo Markdown').fill(markdown);
  await page.route('**/api/access', (route) => route.abort());
  await page.clock.fastForward(61_000);
  await expect(page.getByLabel('Testo Markdown')).toHaveValue(markdown);
  await page.unroute('**/api/access');
  await page.route('**/api/access', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Temporary service failure' })
    })
  );
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
  await page.getByRole('button', { name: 'Ricerca', exact: true }).click();
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
  await page.getByLabel('Preparazione', { exact: true }).selectOption('ready');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await page.getByRole('button', { name: 'Intervista', exact: true }).click();
  await page.getByRole('button', { name: 'Assegna / cambia' }).click();
  await page.getByLabel('Conduttore', { exact: true }).selectOption('alberto');
  await page.getByRole('button', { name: /Conferma (riassegnazione|assegnazione)/ }).click();
  await expect(page.locator('.assignment-control')).toContainText('Alberto');
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
  const accessIdentity = await (await request.post('/api/access', { headers })).json();
  const memberUrl = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1/projects/demo-bacarodeck/databases/(default)/documents/workspaces/codemotion-milano-2026/members/${accessIdentity.uid}`;
  const beforeMember = await (
    await request.get(memberUrl, { headers: { Authorization: 'Bearer owner' } })
  ).json();
  expect((await request.post('/api/access', { headers })).status()).toBe(200);
  const afterMember = await (
    await request.get(memberUrl, { headers: { Authorization: 'Bearer owner' } })
  ).json();
  expect(afterMember.updateTime).toBe(beforeMember.updateTime);

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
  await page.getByRole('navigation', { name: 'Scegli speaker' }).waitFor();
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
  const insightId = `manual-insight-${testInfo.project.name}`;
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'save',
          origin: 'manual',
          changes: [
            {
              collection: 'insights',
              data: {
                id: insightId,
                title: 'Craftsmanship dopo gli agenti',
                bodyMd: 'Uno spunto personale',
                speakerIds: ['abiodun-olowode']
              },
              expectedRevision: null
            }
          ]
        }
      })
    ).status()
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Esporta il mio lavoro' }).click();
  await expect(
    page.locator('.diff-row').filter({ hasText: insightId }).getByRole('heading')
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica export JSON' }).click();
  const file = await downloaded;
  const exported = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(exported.exportKind).toBe('editorial-work');
  expect(exported.insights).toContainEqual(
    expect.objectContaining({ id: insightId, bodyMd: 'Uno spunto personale' })
  );
  expect(JSON.stringify(exported)).not.toContain('createdBy');
  expect(
    exported.speakers?.some((item: { id: string }) => item.id === 'andrey-breslav')
  ).toBeFalsy();
  expect(exported.requiredDocuments).toContainEqual({
    collection: 'speakers',
    id: 'abiodun-olowode'
  });
  const insight = (await (await request.get('/api/data/insights', { headers })).json()).find(
    (item: { id: string }) => item.id === insightId
  );
  expect(
    (
      await request.post('/api/data', {
        headers,
        data: {
          action: 'delete',
          changes: [{ collection: 'insights', data: insight, expectedRevision: insight.revision }]
        }
      })
    ).status()
  ).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Importa JSON', exact: true }).click();
  await page.getByLabel('Apri file JSON').setInputFiles({
    name: 'lavoro.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported))
  });
  await expect(page.getByText('Ripristino lavoro editoriale:', { exact: false })).toBeVisible();
  if (exported.personalRatings?.length)
    await page.getByLabel(/Ripristina .* voti sul mio account attuale/).check();
  await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
  await page.getByRole('button', { name: 'Conferma importazione' }).click();
  await expect(page.getByText(/Importazione completata:/)).toBeVisible();
  const restored = (await (await request.get('/api/data/insights', { headers })).json()).find(
    (item: { id: string }) => item.id === insightId
  );
  expect(restored.bodyMd).toBe('Uno spunto personale');
  expect(restored.entryOrigin).toBe('manual');
  await page.getByRole('button', { name: 'Export / import completo' }).click();
  const fullDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica backup completo' }).click();
  const fullFile = await fullDownload;
  const complete = JSON.parse(await readFile((await fullFile.path())!, 'utf8'));
  expect(complete.format).toBe('bacarodeck-workspace');
  expect(complete.data.speakers).toHaveLength(84);
  expect(complete.data.members.length).toBeGreaterThan(0);
  expect(complete.data.deletedQuestions.length).toBeGreaterThan(0);
  expect(complete.data.access).toBeUndefined();
  if (testInfo.project.name === 'desktop') {
    expect(
      (
        await request.post('/api/data', {
          headers,
          data: {
            action: 'save',
            changes: [
              {
                collection: 'insights',
                data: { ...restored, bodyMd: 'Dopo il backup' },
                expectedRevision: restored.revision
              }
            ]
          }
        })
      ).status()
    ).toBe(200);
    await page.getByLabel('Apri backup completo').setInputFiles({
      name: 'completo.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(complete))
    });
    await expect(page.getByText(/1 da sostituire/)).toBeVisible();
    await page
      .getByLabel('Ho verificato destinazione, sostituzioni e cancellazioni del backup completo')
      .check();
    await page.getByRole('button', { name: 'Ripristina backup completo', exact: true }).click();
    await expect(page.getByText(/Ripristino completo: 1 operazioni completate/)).toBeVisible();
    const recovered = (await (await request.get('/api/data/insights', { headers })).json()).find(
      (item: { id: string }) => item.id === insightId
    );
    expect(recovered.bodyMd).toBe('Uno spunto personale');
    expect(recovered.entryOrigin).toBe('manual');
    expect(
      (
        await request.post('/api/backup', {
          headers,
          data: {
            changes: [
              {
                collection: 'insights',
                id: insightId,
                data: { ...recovered, bodyMd: 'Conflict test' },
                expected: restored
              }
            ]
          }
        })
      ).status()
    ).toBe(409);
    const questionId = 'full-backup-deleted-question';
    expect(
      (
        await request.post('/api/data', {
          headers,
          data: {
            action: 'save',
            changes: [
              {
                collection: 'questions',
                data: { id: questionId, textIt: 'Temporary question', status: 'asked' },
                expectedRevision: null
              }
            ]
          }
        })
      ).status()
    ).toBe(200);
    const question = (await (await request.get('/api/data/questions', { headers })).json()).find(
      (item: { id: string }) => item.id === questionId
    );
    const deletion = {
      changes: [
        { collection: 'questions', id: questionId, data: null, expected: question },
        {
          collection: 'deletedQuestions',
          id: questionId,
          data: { id: questionId, deletedAt: Date.now() },
          expected: null
        }
      ]
    };
    expect((await request.post('/api/backup', { headers, data: deletion })).status()).toBe(200);
    expect((await request.post('/api/backup', { headers, data: deletion })).status()).toBe(200);
    expect(await (await request.get('/api/questions/deleted', { headers })).json()).toContain(
      questionId
    );
  } else {
    expect((await request.post('/api/backup', { headers, data: { changes: [] } })).status()).toBe(
      403
    );
  }
  expect(errors).toEqual([]);
});

test('Google accounts outside ALLOW_LIST cannot open the workspace', async ({ page, request }) => {
  expect((await request.post('/api/access')).status()).toBe(401);
  expect(
    (await request.post('/api/access', { headers: { Authorization: 'Bearer forged' } })).status()
  ).toBe(401);
  expect((await request.get('/api/data/speakers')).status()).toBe(401);
  expect((await request.get('/api/export')).status()).toBe(401);
  expect((await request.get('/api/backup')).status()).toBe(401);
  expect((await request.post('/api/backup', { data: { changes: [] } })).status()).toBe(401);
  expect(
    (await request.post('/api/data', { data: { action: 'save', changes: [] } })).status()
  ).toBe(401);
  await page.goto('/backoffice');
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
