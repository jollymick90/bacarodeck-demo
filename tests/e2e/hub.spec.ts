import { test, expect } from '@playwright/test';

test('member prepares the five speakers, CRUD and import work on screen', async ({
  page,
  request
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();

  await popup
    .getByLabel('Email')
    .fill(`editor-${testInfo.project.name}-${Date.now()}@example.test`);
  await popup.getByLabel('Display name').fill('Editor Bacaro');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  await expect(page.getByText('Accesso riservato ai membri')).toBeVisible();
  const uid = await page.locator('.uid').innerText();
  const response = await request.patch(
    `http://127.0.0.1:8080/v1/projects/demo-bacarodeck/databases/(default)/documents/workspaces/codemotion-milano-2026/members/${uid}`,
    {
      headers: { Authorization: 'Bearer owner' },
      data: {
        fields: { displayName: { stringValue: 'Editor Bacaro' }, role: { stringValue: 'editor' } }
      }
    }
  );
  expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toBeVisible();
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
  await page.getByLabel('Intervistatore', { exact: true }).selectOption(uid);
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
});
