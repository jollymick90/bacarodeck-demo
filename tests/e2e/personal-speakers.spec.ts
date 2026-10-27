import { test, expect } from '@playwright/test';

test('personal speakers include my assignments outside the list and distinguish interests and assignments', async ({
  page,
  request
}, info) => {
  const prefix = `personal-${info.project.name}-${Date.now()}`;
  const email = `editor-${info.project.name}@example.test`;
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(email);
  await popup.getByLabel('Display name').fill('Personal speaker editor');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const speakers = [
    { id: `${prefix}-saved`, fullName: 'Speaker colori interesse', inInterviewList: true },
    { id: `${prefix}-assigned`, fullName: 'Speaker colori assegnato', inInterviewList: false },
    { id: `${prefix}-both`, fullName: 'Speaker colori entrambi', inInterviewList: true },
    { id: `${prefix}-other`, fullName: 'Speaker colori collega', inInterviewList: false },
    { id: `${prefix}-free`, fullName: 'Speaker colori disponibile', inInterviewList: true }
  ];
  const interests = [`${prefix}-saved`, `${prefix}-both`];
  const setInterest = async (speakerId: string, interested: boolean) => {
    const response = await request.post('/api/conductor/interests', {
      headers,
      data: { speakerId, interested }
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: speakers.map((data) => ({ collection: 'speakers', data, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  try {
    for (const suffix of ['assigned', 'both', 'other']) {
      const response = await request.post('/api/conductor/assignment', {
        headers,
        data: {
          speakerId: `${prefix}-${suffix}`,
          teamId: suffix === 'other' ? 'lorenzo' : email,
          expectedOwner: '',
          expectedPlanRevision: null,
          confirmReplacement: false
        }
      });
      expect(response.ok(), await response.text()).toBe(true);
    }
    for (const id of interests) await setInterest(id, true);
    await page.reload();
    const personal = page.getByRole('region', {
      name: 'I miei speaker e i miei assegnati',
      exact: true
    });
    const filters = personal.getByRole('group', { name: 'Filtra i miei speaker' });
    const assigned = page.locator(`[data-speaker="${prefix}-assigned"]`);
    const saved = page.locator(`[data-speaker="${prefix}-saved"]`);
    const both = page.locator(`[data-speaker="${prefix}-both"]`);
    const other = page.locator(`[data-speaker="${prefix}-other"]`);
    await expect(personal.locator('article')).toHaveCount(3);
    await expect(assigned).toBeVisible();
    await expect(assigned.getByText('Assegnato a me', { exact: true })).toBeVisible();
    await expect(assigned.getByText('Fuori lista', { exact: true })).toBeVisible();
    await expect(saved.getByText('In lista', { exact: true })).toBeVisible();
    await expect(both.getByText('Mi interessa', { exact: true })).toBeVisible();
    await expect(both.getByText('Assegnato a me', { exact: true })).toBeVisible();
    await expect(other).toHaveCount(0);
    expect(await assigned.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      await saved.evaluate((el) => getComputedStyle(el).backgroundColor)
    );
    expect(
      await both
        .getByText('Mi interessa', { exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    ).not.toBe(
      await both
        .getByText('Assegnato a me', { exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor)
    );
    await filters.getByRole('button', { name: /Assegnati a me/ }).click();
    await expect(personal.locator('article h3')).toHaveText([
      'Speaker colori assegnato',
      'Speaker colori entrambi'
    ]);
    await expect(filters.getByRole('button', { name: /Assegnati a me/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.reload();
    await expect(personal.locator('article')).toHaveCount(2);
    await filters.getByRole('button', { name: /Mi interessano/ }).click();
    await expect(personal.locator('article')).toHaveCount(2);
    await expect(
      personal.getByRole('heading', { name: 'Speaker colori interesse', exact: true })
    ).toBeVisible();
    await expect(
      personal.getByRole('heading', { name: 'Speaker colori entrambi', exact: true })
    ).toBeVisible();
    await filters.getByRole('button', { name: /Tutti i miei/ }).click();
    await page.getByRole('button', { name: 'Mostra anche gli altri speaker', exact: true }).click();
    await expect(other).toBeVisible();
    await expect(other.getByText('Assegnato a Lorenzo', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('personal-speakers.png'), fullPage: true });
    await both.getByRole('button', { name: '★ Salvato', exact: true }).click();
    await expect(
      both.locator('.card-statuses').getByText('Mi interessa', { exact: true })
    ).toHaveCount(0);
    await expect(personal.locator('article')).toHaveCount(3);
    await expect(both.getByText('Assegnato a me', { exact: true })).toBeVisible();
    await assigned.getByRole('link', { name: 'Apri scheda', exact: true }).click();
    await page.getByRole('button', { name: 'Assegna / cambia' }).click();
    await page.getByRole('combobox', { name: 'Conduttore', exact: true }).selectOption('lorenzo');
    await page.getByRole('button', { name: 'Conferma riassegnazione', exact: true }).click();
    await expect(page.locator('.assignment-control')).toContainText('Lorenzo');
    await page.goto('/?miei=assegnati');
    await expect(personal.locator('article h3')).toHaveText(['Speaker colori entrambi']);
    await page.getByLabel('Cerca speaker').fill('non presente');
    await expect(personal.locator('article')).toHaveCount(0);
  } finally {
    for (const id of interests) await setInterest(id, false);
    const emulator = process.env.FIRESTORE_EMULATOR_HOST!;
    for (const collection of ['interviewPlans', 'speakers']) {
      for (const { id } of speakers) {
        const removed = await request.delete(
          `http://${emulator}/v1/projects/demo-bacarodeck/databases/(default)/documents/workspaces/codemotion-milano-2026/${collection}/${id}`,
          { headers: { Authorization: 'Bearer owner' } }
        );
        expect(removed.ok(), await removed.text()).toBe(true);
      }
    }
  }
});
