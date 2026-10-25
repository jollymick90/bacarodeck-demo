import { test, expect } from '@playwright/test';

test('screens resolve as SvelteKit pages on a direct request', async ({ request }) => {
  for (const path of [
    '/backoffice/programmazione',
    '/backoffice/strumenti',
    '/backoffice/importa',
    '/backoffice/esporta',
    '/backoffice/backup',
    '/backoffice/tag',
    '/backoffice/accessi',
    '/backoffice/nuovo/speakers',
    '/backoffice/speaker/test-speaker',
    '/backoffice/speaker/test-speaker/domande',
    '/backoffice/contenuti/speakers/test-speaker'
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
});

test('speaker and scheduling URLs survive reload and browser history', async ({
  page,
  request
}, info) => {
  await page.goto('/backoffice/programmazione');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Routing test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  await expect(page.getByRole('heading', { name: /Programmazione/ }).first()).toBeVisible();
  const id = `routing-${info.project.name}`;
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
                id,
                fullName: 'Routing speaker',
                headline: 'Engineering lead',
                inInterviewList: true
              },
              expectedRevision: null
            },
            {
              collection: 'talks',
              data: { id: id + '-talk', speakerIds: [id], title: 'Designing resilient systems' },
              expectedRevision: null
            }
          ]
        }
      })
    ).ok()
  ).toBe(true);
  try {
    await page.goto('/backoffice');
    await page.getByLabel('Cerca nome, organizzazione o tag').fill('Routing speaker');
    await expect(page).toHaveURL(/q=Routing/);
    await page
      .getByRole('navigation', { name: 'Scegli speaker' })
      .getByRole('link', { name: /Routing speaker/ })
      .click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}`);
    await page.goBack();
    await expect(page.getByLabel('Cerca nome, organizzazione o tag')).toHaveValue(
      'Routing speaker'
    );
    await expect(
      page.getByRole('navigation', { name: 'Scegli speaker' }).getByRole('link')
    ).toHaveCount(1);
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Routing speaker', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('navigation', { name: 'Gestione', exact: true })
    ).toHaveCount(0);
    await expect(
      page
        .getByRole('contentinfo')
        .getByRole('navigation', { name: 'Gestione', exact: true })
        .getByRole('link', { name: 'Speaker', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Engineering lead', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Contenuti dello speaker' }).getByRole('link')
    ).toHaveText(['Info', 'Note', 'Intervista', 'Strumenti']);
    await expect(
      page.getByRole('link', { name: 'Designing resilient systems', exact: true })
    ).toHaveAttribute('href', `/backoffice/speaker/${id}/talk`);
    await page.getByRole('link', { name: 'Designing resilient systems', exact: true }).click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/talk`);
    await page.getByRole('link', { name: 'Note', exact: true }).click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/note`);
    await expect(page.locator('.research-assistant')).toHaveCount(0);
    await page.getByRole('button', { name: 'Informazioni: Note dello speaker' }).click();
    const help = page.getByRole('dialog', { name: 'Informazioni: Note dello speaker' });
    await expect(help).toContainText('appunti, fonti e spunti condivisi');
    await help.getByRole('button', { name: 'Ho capito' }).click();
    await expect(help).not.toBeVisible();
    await page.screenshot({ path: info.outputPath('speaker-notes.png'), fullPage: true });
    await page
      .getByRole('navigation', { name: 'Contenuti dello speaker' })
      .getByRole('link', { name: 'Strumenti', exact: true })
      .click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/strumenti`);
    await expect(
      page.getByRole('heading', { name: 'Prompt precompilati', exact: true })
    ).toBeVisible();
    const groups = page.locator('.prompt-group');
    await expect(groups).toHaveCount(3);
    await expect(page.locator('.prompt-group[open]')).toHaveCount(0);
    await groups.nth(0).locator('summary').click();
    await expect(
      page.getByRole('button', { name: 'Copia prompt ricerca', exact: true })
    ).toBeVisible();
    await groups.nth(1).locator('summary').click();
    await expect(page.locator('.prompt-group[open]')).toHaveCount(2);
    await groups.nth(0).locator('summary').click();
    await expect(
      page.getByRole('button', { name: 'Copia prompt ricerca', exact: true })
    ).not.toBeVisible();
    await page.reload();
    await groups.nth(2).locator('summary').click();
    await expect(
      page.getByRole('button', { name: 'Copia prompt audio IT', exact: true })
    ).toBeVisible();
    await page.goto(`/backoffice/speaker/${id}/ricerca?lang=en`);
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/note?lang=en`);
    await page.getByRole('link', { name: 'Intervista', exact: true }).click();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/intervista`);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Routing speaker', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Gestione', exact: true }).click();
    await expect(page).toHaveURL('/backoffice');
    await expect(page.getByRole('heading', { name: 'Routing speaker', exact: true })).toHaveCount(
      0
    );
    await page.goBack();
    await expect(page).toHaveURL(`/backoffice/speaker/${id}/intervista`);
    await expect(page.getByRole('heading', { name: 'Routing speaker', exact: true })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL('/backoffice');
    await page.getByRole('link', { name: 'Programmazione', exact: true }).click();
    await expect(page).toHaveURL('/backoffice/programmazione');
    await page.goto(`/backoffice/contenuti/speakers/${id}`);
    await expect(page.locator('.editor')).toContainText('Routing speaker');
    await page.reload();
    await expect(page.locator('.editor')).toContainText('Routing speaker');
    await expect(page.locator('.editor input')).toHaveCount(0);
    await page.goto('/backoffice/importa/esempio');
    await expect(page.getByLabel('JSON da importare')).toHaveValue(/Andrey Breslav/);
    await page.reload();
    await expect(page.getByLabel('JSON da importare')).toHaveValue(/Andrey Breslav/);
    await page.goto('/backoffice/accessi');
    if (info.project.name === 'mobile')
      await expect(
        page.getByRole('heading', { name: 'Accesso riservato agli amministratori' })
      ).toBeVisible();
    await page.goto('/backoffice/speaker/missing-speaker');
    await expect(page.getByRole('heading', { name: 'Speaker non trovato' })).toBeVisible();
  } finally {
    const talks = await (await request.get('/api/data/talks', { headers })).json();
    const talk = talks.find((row: { id: string }) => row.id === id + '-talk');
    if (talk)
      await request.post('/api/data', {
        headers,
        data: {
          action: 'delete',
          changes: [{ collection: 'talks', data: talk, expectedRevision: talk.revision }]
        }
      });
    const rows = await (await request.get('/api/data/speakers', { headers })).json();
    const speaker = rows.find((row: { id: string }) => row.id === id);
    if (speaker)
      await request.post('/api/data', {
        headers,
        data: {
          action: 'delete',
          changes: [{ collection: 'speakers', data: speaker, expectedRevision: speaker.revision }]
        }
      });
  }
});
