import { test, expect } from '@playwright/test';

test('interview assignments follow enabled access, including users before first login and revocations', async ({
  page,
  request
}, info) => {
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill('editor-desktop@example.test');
  await popup.getByLabel('Display name').fill('Editor Bacaro');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible();
  const id = `assignee-${info.project.name}`;
  const email = `${id}@example.test`;
  const setAccess = async (address: string, enabled: boolean) => {
    const response = await request.post('/api/admin/access', {
      headers,
      data: { email: address, enabled }
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  try {
    await setAccess(email, true);
    const saved = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'speakers',
            data: { id, fullName: 'Speaker accessi', inInterviewList: true },
            expectedRevision: null
          }
        ]
      }
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    await page.goto('/speaker/' + id);
    await page.getByRole('button', { name: 'Assegna / cambia' }).click();
    const select = page.getByRole('combobox', { name: 'Conduttore', exact: true });
    const entries = await (await request.get('/api/admin/access', { headers })).json();
    const directory = await (await request.get('/api/data/assignees', { headers })).json();
    expect(directory.map((e: { email: string }) => e.email).sort()).toEqual(
      entries
        .filter((e: { enabled: boolean }) => e.enabled)
        .map((e: { email: string }) => e.email)
        .sort()
    );
    await expect(select.locator('option')).toHaveCount(directory.length);
    await expect(select.locator('option[value="danilo"]')).toContainText('danxivdan@gmail.com');
    await expect(select.locator('option[value="lorenzo"]')).toContainText(
      'this.lorenzo.99@gmail.com'
    );
    await select.selectOption(email);
    await page.getByRole('button', { name: 'Conferma assegnazione', exact: true }).click();
    await expect(page.locator('.assignment-control')).toContainText(id);
    await page.getByRole('button', { name: 'Assegna / cambia' }).click();
    await select.selectOption('danilo');
    await setAccess('danxivdan@gmail.com', false);
    await page.getByRole('button', { name: 'Conferma riassegnazione', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('non valido');
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();
    await page.reload();
    await expect(page.locator('.assignment-control')).toContainText(id);
    await page.getByRole('button', { name: 'Assegna / cambia' }).click();
    await expect(select.locator('option[value="danilo"]')).toHaveCount(0);
    await select.selectOption('lorenzo');
    await page.getByRole('button', { name: 'Conferma riassegnazione', exact: true }).click();
    await expect(page.locator('.assignment-control')).toContainText('Lorenzo');
    await page.goto('/backoffice?conduttore=lorenzo');
    await expect(page.getByRole('link', { name: /Speaker accessi/ })).toBeVisible();
  } finally {
    await setAccess('danxivdan@gmail.com', true);
    await setAccess(email, false);
    const emulator = process.env.FIRESTORE_EMULATOR_HOST!;
    for (const collection of ['speakers', 'interviewPlans']) {
      await request.delete(
        `http://${emulator}/v1/projects/demo-bacarodeck/databases/(default)/documents/workspaces/codemotion-milano-2026/${collection}/${id}`,
        { headers: { Authorization: 'Bearer owner' } }
      );
    }
  }
});
