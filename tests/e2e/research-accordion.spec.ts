import { test, expect } from '@playwright/test';

test('question prompt keeps research selection open and includes the editorial brief', async ({
  page,
  request
}, info) => {
  const id = `research-accordion-${info.project.name}-${Date.now()}`;
  await page.goto('/backoffice');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
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
        { collection: 'speakers', data: { id, fullName: 'Research test' }, expectedRevision: null },
        ...[1, 2].map((n) => ({
          collection: 'materials',
          data: {
            id: `${id}-note-${n}`,
            speakerIds: [id],
            title: `Nota selezionabile ${n}`,
            bodyMd: `Contenuto esclusivo ${n}`
          },
          expectedRevision: null
        }))
      ]
    }
  });
  expect(result.status()).toBe(200);
  await page.goto(`/backoffice/speaker/${id}/strumenti`);
  const group = page.locator('.prompt-group').nth(1);
  await group.locator('summary').click();
  const first = group.getByRole('checkbox').nth(0);
  const second = group.getByRole('checkbox').nth(1);
  await first.check();
  await expect(group).toHaveAttribute('open');
  await second.check();
  await expect(group).toHaveAttribute('open');
  await first.uncheck();
  await expect(group).toHaveAttribute('open');
  await group.getByRole('button', { name: 'Copia prompt domande' }).click();
  await expect(group).toHaveAttribute('open');
  const prompt = page.getByLabel(/Prompt pronto/);
  await expect(prompt).toHaveValue(/Contenuto esclusivo 2/);
  await expect(prompt).not.toHaveValue(/Contenuto esclusivo 1/);
  await expect(prompt).toHaveValue(/motore dell’AI in Italia/);
  await expect(prompt).toHaveValue(/1\) TALK[\s\S]*2\) AI[\s\S]*3\) PONTE/);
  await group.locator('summary').click();
  await expect(group).not.toHaveAttribute('open');
  await group.locator('summary').click();
  await expect(second).toBeChecked();
  await page.goto(`/backoffice/speaker/${id}/strumenti?prompt=domande`);
  await expect(group).toHaveAttribute('open');
  await group.getByRole('checkbox').first().check();
  await expect(group).toHaveAttribute('open');
});
