import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
const markdown = readFileSync(
  new URL('../fixtures/generated-questions.md', import.meta.url),
  'utf8'
);
test('imports pasted bilingual questions once after preview', async ({ page, request }, info) => {
  const id = `question-import-${info.project.name}-${Date.now()}`;
  await page.goto('/backoffice');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('networkidle');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Research test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };

  const result = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: { id, fullName: 'Question import test' },
          expectedRevision: null
        }
      ]
    }
  });
  expect(result.status()).toBe(200);
  await page.goto(`/backoffice/speaker/${id}/strumenti`);
  const importer = page.getByRole('region', { name: 'Importa domande da AI' });
  await importer.getByLabel('Risposta con le domande').fill(markdown);
  await importer.getByRole('button', { name: 'Mostra anteprima domande' }).click();
  await expect(importer.getByRole('article')).toHaveCount(7);
  await expect(importer.getByRole('article').first()).toContainText('When presenting EARS');
  await importer.getByRole('checkbox').last().uncheck();
  await expect(
    importer.getByRole('button', { name: 'Conferma e importa 6 domande' })
  ).toBeEnabled();
  await importer.getByRole('checkbox').last().check();
  await importer.getByRole('button', { name: 'Conferma e importa 7 domande' }).click();
  await expect(importer.getByRole('status')).toContainText('7 domande aggiunte');
  await page.reload();
  await importer.getByLabel('Risposta con le domande').fill(markdown);
  await importer.getByRole('button', { name: 'Mostra anteprima domande' }).click();
  await expect(importer.getByRole('status')).toContainText('già presenti');
  await expect(importer.getByRole('article')).toHaveCount(0);
  await importer.getByRole('link', { name: 'Vai alle domande' }).click();
  await expect(
    page.getByText('Nel presentare il metodo EARS utilizzi', { exact: false }).first()
  ).toBeVisible();
});
