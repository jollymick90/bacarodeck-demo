import { test, expect } from '@playwright/test';

test('interview shows only one question, rotates, finishes and exits without changing the brief', async ({
  page,
  request
}, info) => {
  const id = `interview-mode-${info.project.name}-${Date.now()}`;
  // Exercise the fallback on mobile, where the native Fullscreen API may be unavailable.
  if (info.project.name === 'mobile')
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () =>
        Promise.reject(new Error('Fullscreen unavailable'));
    });
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Interview test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const result = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: { id, fullName: 'Interview mode test' },
          expectedRevision: null
        },
        ...[1, 2, 3].map((n) => ({
          collection: 'questions',
          data: {
            id: `${id}-q${n}`,
            speakerId: id,
            textIt: `Domanda da intervista ${n}?`,
            textEn:
              `Interview question ${n}?` +
              (n === 2
                ? ' When an AI agent produces convincing code and tests from the same mistaken specification, how would you introduce an independent check without making every delivery depend on a single expert reviewer?'
                : ''),
            order: n,
            status: 'suggested'
          },
          expectedRevision: null
        }))
      ]
    }
  });
  expect(result.status()).toBe(200);
  await page.goto(`/speaker/${id}?lang=en`);
  await page.getByRole('button', { name: 'Avvia intervista', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/speaker/${id}/intervista`));
  const viewer = page.getByRole('region', { name: 'Modalità intervista' });
  await expect(viewer).toBeVisible();
  await expect(viewer).toContainText('Interview question 1?');
  await expect(viewer).not.toContainText('Interview question 2?');
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(2);
  if (info.project.name === 'desktop')
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: 'Prossima domanda' })).toBeInViewport();
  await page.getByRole('button', { name: 'Prossima domanda' }).click();
  await expect(viewer).toContainText('Interview question 2?');
  await page.screenshot({ path: `.superpowers/interview-mode/${info.project.name}-landscape.png` });
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `.superpowers/interview-mode/${info.project.name}-portrait.png` });
  await expect(page.getByRole('button', { name: 'Esci', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: 'Prossima domanda' }).click();
  await expect(viewer).toContainText('Interview question 3?');
  await expect(page.getByRole('button', { name: 'Prossima domanda' })).toBeDisabled();
  await page.getByRole('button', { name: 'Esci', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/speaker/${id}\\?`));
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.getByRole('button', { name: 'Avvia intervista', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Avvia intervista', exact: true }).click();
  await expect(viewer).toBeVisible();
  await page.goBack();
  await expect(viewer).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  // Direct links and Escape also work without a browser fullscreen gesture.
  await page.goto(`/speaker/${id}/intervista?lang=en`);
  await expect(viewer).toContainText('Interview question 1?');
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
});
