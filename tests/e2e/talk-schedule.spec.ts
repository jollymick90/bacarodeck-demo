import { test, expect } from '@playwright/test';

test('default speaker schedule imports into existing data and remains editable', async ({
  page,
  request
}, info) => {
  const id = `hours-${info.project.name}-${Date.now()}`;
  await page.goto('/backoffice/importa/orari');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Schedule editor');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const read = async (collection: string) =>
    (await (await request.get(`/api/data/${collection}`, { headers })).json()).find(
      (e: { id: string }) => e.id === id
    );
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: { id, fullName: 'Abiodun Olowode', inInterviewList: true },
          expectedRevision: null
        },
        {
          collection: 'talks',
          data: {
            id,
            speakerIds: [id],
            title: 'We Review Code. Why Won’t We Review Each Other?',
            notesMd: 'Preserve this research'
          },
          expectedRevision: null
        }
      ]
    }
  });
  expect(created.status()).toBe(200);
  try {
    await page.goto(`/backoffice/speaker/${id}`);
    await expect(page.locator('.talk-schedule')).toContainText('11:20–11:50');
    await expect(page.locator('.talk-schedule')).toContainText('orario predefinito');
    expect((await read('talks')).time).toBeUndefined();
    await page.goto('/backoffice/importa/orari');
    await expect(page.getByRole('heading', { name: 'Importa orari Codemotion' })).toBeVisible();
    await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
    await page
      .getByRole('button', { name: 'Seleziona tutti gli aggiornamenti degli orari' })
      .click();
    await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page).toHaveURL(/\/backoffice$/);
    expect(await read('talks')).toMatchObject({
      time: '11:20',
      endTime: '11:50',
      notesMd: 'Preserve this research'
    });
    await page.goto(`/backoffice/contenuti/talks/${id}?speaker=${id}`);
    await page.locator('.editor').getByRole('button', { name: 'Modifica', exact: true }).click();
    await page.getByLabel('Inizio talk (HH:mm)', { exact: true }).fill('12:10');
    await page.getByLabel('Fine talk (HH:mm)', { exact: true }).fill('12:40');
    await page.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page.locator('.talk-schedule')).toContainText('12:10–12:40');
    expect(await read('talks')).toMatchObject({
      time: '12:10',
      endTime: '12:40',
      notesMd: 'Preserve this research'
    });
    await page.reload();
    await expect(page.locator('.talk-schedule')).toContainText('12:10–12:40');
    await page.goto('/backoffice/importa/orari');
    await page
      .getByLabel('Carica un JSON degli orari')
      .setInputFiles({
        name: 'orari.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            sessions: [
              {
                sessionId: '1214501',
                title: 'We Review Code. Why Won’t We Review Each Other?',
                speakers: ['Abiodun Olowode'],
                startsAt: '2026-10-28T13:10:00+01:00',
                endsAt: '2026-10-28T13:40:00+01:00',
                room: 'NUOVA SALA'
              }
            ]
          })
        )
      });
    await expect(page.locator('#import-json')).toHaveValue(/13:10/);
    await page.getByRole('button', { name: 'Valida e mostra anteprima' }).click();
    await page
      .getByRole('button', { name: 'Seleziona tutti gli aggiornamenti degli orari' })
      .click();
    await page.getByLabel('Ho verificato le differenze e approvo queste scritture').check();
    await page.getByRole('button', { name: 'Conferma importazione' }).click();
    await expect(page).toHaveURL(/\/backoffice$/);
    expect(await read('talks')).toMatchObject({
      time: '13:10',
      endTime: '13:40',
      stage: 'NUOVA SALA',
      notesMd: 'Preserve this research'
    });
  } finally {
    for (const collection of ['talks', 'speakers']) {
      const data = await read(collection);
      if (data)
        await request.post('/api/data', {
          headers,
          data: {
            action: 'delete',
            changes: [{ collection, data, expectedRevision: data.revision }]
          }
        });
    }
  }
});
