import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, chromium } from '@playwright/test';

test('favicon is available without a server error', async ({ request }) => {
  const response = await request.get('/favicon.ico');
  expect(response.status()).toBe(200);
  // Vite's MIME table omits ICO; check that the actual icon is served.
  expect([...(await response.body()).subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
});

test('the same account is restored after a full browser restart', async ({ baseURL }, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'bacarodeck-session-'));
  const options = {
    baseURL,
    viewport: info.project.use.viewport,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch
  };
  let context = await chromium.launchPersistentContext(profile, options);
  try {
    const page = await context.newPage();
    await page.goto('/');
    const firstAccess = page.waitForResponse('**/api/access');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Accedi con Google' }).click();
    const popup = await popupPromise;
    await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
    await popup.getByLabel('Display name').fill('Persistent session test');
    await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
    const identity = await (await firstAccess).json();
    expect(identity.allowed).toBe(true);
    await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();
    await context.close();

    context = await chromium.launchPersistentContext(profile, options);
    const reopened = await context.newPage();
    const restoredAccess = reopened.waitForResponse('**/api/access');
    await reopened.goto('/backoffice');
    await expect(
      reopened.getByRole('heading', { name: 'Prepariamo le interviste.' })
    ).toBeVisible();
    const restored = await (await restoredAccess).json();
    expect(restored.allowed).toBe(true);
    expect(restored.uid).toBe(identity.uid);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test('one login survives route changes, reload and reopening, until logout', async ({
  page,
  context
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toHaveCount(0);
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Session test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();

  for (let i = 0; i < 2; i++) {
    await page.getByRole('link', { name: 'Gestione', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Navigazione principale' })
      .getByRole('link', { name: 'Speaker', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Gestione', exact: true }).click();
  const tabs = page.getByRole('navigation', { name: 'Gestione' });
  await expect(tabs.getByRole('link')).toHaveText(['Speaker', 'Programmazione', 'Strumenti']);
  await tabs.getByRole('link', { name: 'Programmazione', exact: true }).click();
  await expect(tabs.getByRole('link', { name: 'Programmazione', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await tabs.getByRole('link', { name: 'Strumenti', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strumenti', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = page.getByRole('navigation', { name: 'Navigazione principale' });
  await expect(footer.getByRole('link', { name: 'Gestione', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(
    await footer.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    })
  ).toBe(true);
  await expect(page.getByRole('link', { name: '← Vista conduttore' })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('navigation.png'), fullPage: true });
  await footer.getByRole('link', { name: 'Topic', exact: true }).click();
  await expect(page).toHaveURL('/topic');
  await expect(footer.getByRole('link', { name: 'Topic', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  );
  await footer.getByRole('link', { name: 'Speaker', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();
  expect(errors).toEqual([]);

  // Close every app tab: the next document must restore persisted authentication.
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/backoffice');
  await expect(reopened.getByRole('heading', { name: 'Prepariamo le interviste.' })).toBeVisible();
  await expect(reopened.getByRole('button', { name: 'Esci', exact: true })).toBeHidden();
  await reopened.getByRole('button', { name: 'Utente', exact: true }).click();
  await expect(reopened.getByRole('button', { name: 'Esci', exact: true })).toBeVisible();
  await reopened.keyboard.press('Escape');
  await expect(reopened.getByRole('button', { name: 'Esci', exact: true })).toBeHidden();
  await reopened.getByRole('button', { name: 'Utente', exact: true }).click();
  await reopened.getByRole('button', { name: 'Esci', exact: true }).click();
  await expect(reopened.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
  await reopened.goto('/');
  await expect(reopened.getByRole('button', { name: 'Accedi con Google' })).toBeVisible();
  await expect(reopened.getByRole('heading', { name: 'Chi intervistiamo?' })).toHaveCount(0);
});
