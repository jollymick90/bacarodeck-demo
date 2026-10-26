import { test, expect } from '@playwright/test';

const speakers = [
  { id: 'abiodun-olowode', fullName: 'Abiodun Olowode' },
  { id: 'andrey-breslav', fullName: 'Andrey Breslav' },
  { id: 'alexio-cassani', fullName: 'Alexio Cassani' },
  { id: 'alfonso-fuggetta', fullName: 'Alfonso Fuggetta' },
  { id: 'alfonso-graziano', fullName: 'Alfonso Graziano' }
];

test('removed audio files are no longer publicly available', async ({ request }) => {
  for (const speaker of speakers) {
    const response = await request.get(`/audio/${speaker.id}.m4a`, {
      headers: { Range: 'bytes=0-127' }
    });
    expect(response.status(), speaker.id).toBe(404);
  }
});

test('speaker pages do not show or request audio briefings', async ({ page, request }, info) => {
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Audio removal test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  // This suite runs only against the isolated demo Firebase emulators.
  const existing = await (await request.get('/api/data/speakers', { headers })).json();
  const missing = speakers.filter(
    (speaker) => !existing.some((item: { id: string }) => item.id === speaker.id)
  );
  if (missing.length) {
    const saved = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: missing.map(({ id, fullName }) => ({
          collection: 'speakers',
          data: { id, fullName },
          expectedRevision: null
        }))
      }
    });
    expect(saved.status()).toBe(200);
  }
  const downloads: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/audio/')) downloads.push(request.url());
  });
  for (const speaker of speakers) {
    await page.goto(`/speaker/${speaker.id}`);
    await expect(page.getByRole('heading', { name: speaker.fullName, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Briefing audio' })).toHaveCount(0);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Apri o scarica l’audio' })).toHaveCount(0);
  }
  expect(downloads).toEqual([]);
});
