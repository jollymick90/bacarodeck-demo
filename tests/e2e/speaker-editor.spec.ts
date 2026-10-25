import { test, expect } from '@playwright/test';

test('profile and interview save together, cancel together and retain drafts on conflict', async ({
  page,
  request
}, info) => {
  const id = `unified-editor-${info.project.name}-${Date.now()}`;
  await page.goto('/backoffice');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Editor test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const read = async (collection: string) =>
    (await (await request.get(`/api/data/${collection}`, { headers })).json()).find(
      (item: { id: string }) => item.id === id
    );
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: {
            id,
            fullName: 'Unified editor',
            inInterviewList: true,
            biographyIt: '**Descrizione italiana**\n\nTesto completo da leggere.',
            biographyEn: '**English description**\n\nFull text to read.'
          },
          expectedRevision: null
        }
      ]
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  try {
    await page.goto('/backoffice');
    await expect(page.getByRole('link', { name: /Unified editor/ })).toBeVisible();
    await page.getByRole('link', { name: /Unified editor/ }).click();
    const edit = page.getByRole('link', { name: 'Modifica profilo e intervista', exact: true });
    await expect(edit).toBeVisible();
    await edit.click();
    const editor = page.locator('.editor');
    await expect(editor.locator('input, textarea, select')).toHaveCount(0);
    await expect(
      editor.locator('strong').filter({ hasText: 'Descrizione italiana' })
    ).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Salva modifiche' })).toHaveCount(0);
    const language = editor.getByRole('group', { name: 'Lingua descrizione', exact: true });
    await language.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(editor.locator('strong').filter({ hasText: 'English description' })).toBeVisible();
    await expect(editor.getByText('Testo completo da leggere.')).toHaveCount(0);
    expect((await read('speakers')).biographyIt).toContain('Descrizione italiana');
    await page.screenshot({ path: info.outputPath('editor-reading.png'), fullPage: true });
    await editor.getByRole('button', { name: 'Modifica', exact: true }).click();
    const description = editor.getByRole('textbox', { name: 'Descrizione', exact: true });
    await expect(description).toHaveCount(1);
    await description.fill('English draft');
    await language.getByRole('button', { name: 'IT', exact: true }).click();
    await expect(description).toHaveValue(/Descrizione italiana/);
    await description.fill('Bozza italiana');
    await language.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(description).toHaveValue('English draft');
    const profile = page.getByRole('group', { name: 'Profilo speaker', exact: true });
    const interview = page.getByRole('group', { name: 'Preparazione intervista', exact: true });
    await profile.getByLabel('Organizzazione', { exact: true }).fill('Nuova organizzazione');
    await profile.getByLabel('Note', { exact: true }).fill('Note profilo');
    await interview.getByLabel('Preparazione', { exact: true }).selectOption('ready');
    await interview.getByLabel('Note', { exact: true }).fill('Note intervista');
    await page.screenshot({ path: info.outputPath('profile-interview.png'), fullPage: true });
    await expect(page.getByRole('button', { name: 'Salva modifiche', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
    await expect(edit).toBeVisible();
    expect(await read('speakers')).toMatchObject({
      organization: 'Nuova organizzazione',
      biographyIt: 'Bozza italiana',
      biographyEn: 'English draft',
      notesMd: 'Note profilo'
    });
    expect(await read('interviewPlans')).toMatchObject({
      speakerId: id,
      status: 'ready',
      notesMd: 'Note intervista'
    });

    await edit.click();
    await page.locator('.editor').getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(profile.getByLabel('Note', { exact: true })).toHaveValue('Note profilo');
    await expect(interview.getByLabel('Note', { exact: true })).toHaveValue('Note intervista');
    await profile.getByLabel('Organizzazione', { exact: true }).fill('Da annullare');
    await interview.getByLabel('Preparazione', { exact: true }).selectOption('done');
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();
    expect((await read('speakers')).organization).toBe('Nuova organizzazione');
    expect((await read('interviewPlans')).status).toBe('ready');

    await edit.click();
    await page.locator('.editor').getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByLabel('Organizzazione', { exact: true }).fill('Bozza locale');
    await interview.getByLabel('Note', { exact: true }).fill('Bozza intervista');
    const plan = await read('interviewPlans');
    const concurrent = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'interviewPlans',
            data: { ...plan, notesMd: 'Modifica altrui' },
            expectedRevision: plan.revision
          }
        ]
      }
    });
    expect(concurrent.ok(), await concurrent.text()).toBe(true);
    await page.getByRole('button', { name: 'Salva modifiche', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Conflitto');
    await expect(profile.getByLabel('Organizzazione', { exact: true })).toHaveValue('Bozza locale');
    await expect(interview.getByLabel('Note', { exact: true })).toHaveValue('Bozza intervista');
    expect((await read('speakers')).organization).toBe('Nuova organizzazione');
    expect((await read('interviewPlans')).notesMd).toBe('Modifica altrui');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
  } finally {
    const changes = [];
    for (const collection of ['speakers', 'interviewPlans']) {
      const data = await read(collection);
      if (data) changes.push({ collection, data, expectedRevision: data.revision });
    }
    expect(
      (await request.post('/api/data', { headers, data: { action: 'delete', changes } })).ok()
    ).toBe(true);
  }
});
