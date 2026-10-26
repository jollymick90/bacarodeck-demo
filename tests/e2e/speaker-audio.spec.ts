import { test, expect } from '@playwright/test';

const speakers = [
  { id: 'abiodun-olowode', fullName: 'Abiodun Olowode', seconds: 880 },
  { id: 'andrey-breslav', fullName: 'Andrey Breslav', seconds: 828 },
  { id: 'alexio-cassani', fullName: 'Alexio Cassani', seconds: 699 },
  { id: 'alfonso-fuggetta', fullName: 'Alfonso Fuggetta', seconds: 1268 },
  { id: 'alfonso-graziano', fullName: 'Alfonso Graziano', seconds: 901 }
];

test('public audio files support partial downloads without login', async ({ request }) => {
  for (const speaker of speakers) {
    const response = await request.get(`/audio/${speaker.id}.m4a`, {
      headers: { Range: 'bytes=0-127' }
    });
    expect(response.status(), speaker.id).toBe(206);
    expect(response.headers()['content-type']).toMatch(/^audio\/(mp4|x-m4a)/);
    expect(response.headers()['content-range']).toMatch(/^bytes 0-127\/\d+$/);
    const bytes = await response.body();
    expect(bytes.length).toBe(128);
    expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');
  }
});

test('speaker briefings load on play and remain usable on mobile', async ({
  page,
  request
}, info) => {
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Audio test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  // This suite runs only against the isolated demo Firebase emulators.
  const existing = await (await request.get('/api/data/speakers', { headers })).json();
  const missing = [...speakers, { id: 'no-audio', fullName: 'Speaker senza audio' }].filter(
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
    const briefing = page.getByRole('region', { name: 'Briefing audio' });
    await expect(briefing).toBeVisible();
    const audio = briefing.locator('audio');
    await expect(audio).toHaveAttribute('preload', 'none');
    await expect(audio).toHaveAttribute('src', `/audio/${speaker.id}.m4a`);
    expect(downloads.filter((url) => url.endsWith(`/${speaker.id}.m4a`))).toHaveLength(0);
    await expect(briefing.getByRole('link', { name: 'Apri o scarica l’audio' })).toHaveAttribute(
      'href',
      `/audio/${speaker.id}.m4a`
    );
    await audio.evaluate((element: HTMLAudioElement) => element.play());
    await expect
      .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
      .toBeGreaterThan(0);
    const duration = await audio.evaluate((element: HTMLAudioElement) => element.duration);
    expect(Math.abs(duration - speaker.seconds)).toBeLessThan(1);
    await audio.evaluate((element: HTMLAudioElement) => {
      element.pause();
      element.currentTime = 60;
    });
    await expect
      .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
      .toBeGreaterThanOrEqual(60);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    if (speaker.id === 'abiodun-olowode') {
      await briefing.screenshot({ path: info.outputPath('speaker-audio.png') });
    }
  }
  await page.goto('/speaker/no-audio');
  await expect(page.getByRole('heading', { name: 'Speaker senza audio' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Briefing audio' })).toHaveCount(0);
});
