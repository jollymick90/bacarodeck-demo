import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect, chromium } from '@playwright/test';

test('prepared data survives closing the browser and reopening unread routes offline', async ({
  baseURL,
  request
}, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'bacarodeck-offline-'));
  const options = {
    baseURL,
    viewport: info.project.use.viewport,
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch
  };
  let context = await chromium.launchPersistentContext(profile, options);
  try {
    let page = await context.newPage();
    // Existing installed PWAs can still have the old worker controlling their window.
    // It ignores PREPARE_OFFLINE while the new worker is waiting for activation.
    if (info.project.name === 'mobile') {
      await context.route('**/service-worker.js', (route) =>
        route.fulfill({
          contentType: 'application/javascript',
          body: `self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
          self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));`
        })
      );
    }
    const errors: string[] = [];
    console.log('[offline] opening app');
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    if (info.project.name === 'mobile') {
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await context.unroute('**/service-worker.js');
      await page.evaluate(async () => {
        await (await navigator.serviceWorker.ready).update();
      });
      await expect
        .poll(() =>
          page.evaluate(async () => Boolean((await navigator.serviceWorker.ready).waiting))
        )
        .toBe(true);
    }
    const access = page.waitForRequest('**/api/access');
    void access.catch(() => {});
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Accedi con Google' }).click();
    const popup = await popupPromise;
    console.log('[offline] popup opened');
    await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
    const email = `editor-${info.project.name}@example.test`;
    const existing = popup.getByText(email, { exact: true });
    if (await existing.count()) await existing.first().click();
    else {
      await popup.getByRole('button', { name: 'Add new account' }).click();
      await popup.getByLabel('Email').fill(email);
      await popup.getByLabel('Display name').fill('Offline member');
      await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
    }
    console.log('[offline] submitted sign-in');
    const token = (await access).headers().authorization;
    console.log('[offline] access request observed');
    const id = 'offline-' + info.project.name + '-' + Date.now();
    const response = await request.post('/api/data', {
      headers: { Authorization: token },
      timeout: 15000,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'speakers',
            data: { id, fullName: 'Offline Speaker ' + info.project.name, inInterviewList: true }
          },
          {
            collection: 'talks',
            data: { id: id + '-talk', speakerIds: [id], title: 'Offline talk' }
          },
          {
            collection: 'materials',
            data: {
              id: id + '-material',
              speakerIds: [id],
              bodyMd: 'Approfondimento mai aperto prima del download.'
            }
          },
          ...[1, 2, 3].map((n) => ({
            collection: 'questions',
            data: {
              id: id + '-q' + n,
              speakerId: id,
              order: n,
              textIt: 'Domanda offline ' + n,
              textEn: 'Offline question ' + n,
              status: 'approved'
            }
          }))
        ].map((c) => ({ ...c, expectedRevision: null }))
      }
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    console.log('[offline] seed saved');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Chi intervistiamo?' })).toBeVisible();
    console.log('[offline] workspace loaded');
    await page.getByText('Dati su questo dispositivo', { exact: true }).click();
    await page.getByRole('button', { name: 'Prepara questo telefono per l’evento' }).click();
    await expect(page.getByText('Pronto per l’evento', { exact: true })).toBeVisible({
      timeout: 45000
    });
    await expect(page.getByText(/Accesso offline fino al/)).toBeVisible();
    const apiCaches = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (
        await Promise.all(
          keys.map(async (k) =>
            (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname)
          )
        )
      )
        .flat()
        .filter((p) => p.startsWith('/api/'));
    });
    expect(apiCaches).toEqual([]);
    expect(errors).toEqual([]);
    console.log('[offline] package ready');
    // A failed update must keep the previous committed package.
    const savedDate = await page.getByText(/Contenuti aggiornati il/).innerText();
    await page.route('**/api/offline?*', (route) => route.abort('failed'));
    await page.getByRole('button', { name: 'Aggiorna adesso' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'La copia precedente è conservata.' })
    ).toBeVisible();
    expect(await page.getByText(/Contenuti aggiornati il/).innerText()).toBe(savedDate);
    await page.unroute('**/api/offline?*');
    console.log('[offline] interrupted update preserved');
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      (globalThis as any).restoreOfflinePut = () => {
        IDBObjectStore.prototype.put = original;
      };
      IDBObjectStore.prototype.put = function (value: any, key?: IDBValidKey) {
        if (this.name === 'snapshots')
          throw new DOMException('Quota esaurita', 'QuotaExceededError');
        return original.call(this, value, key!);
      };
    });
    await page.getByRole('button', { name: 'Aggiorna adesso' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Quota esaurita' })).toBeVisible();
    expect(await page.getByText(/Contenuti aggiornati il/).innerText()).toBe(savedDate);
    await page.evaluate(() => (globalThis as any).restoreOfflinePut());
    await page.screenshot({ path: info.outputPath('offline-device.png') });
    console.log('[offline] quota failure preserved');
    // A dialog already open when the connection drops remains dismissible.
    await page.goto(`/speaker/${id}`);
    await page.getByRole('button', { name: 'Scegli una domanda', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Scegli una domanda' });
    await context.setOffline(true);
    await expect(page.getByText('Consultazione offline', { exact: true })).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Chiudi', exact: true })).toBeEnabled();
    await picker.getByRole('button', { name: 'Chiudi', exact: true }).click();
    console.log('[offline] package prepared, restarting browser');
    await context.close();
    context = await chromium.launchPersistentContext(profile, options);
    await context.setOffline(true);
    page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/backoffice');
    await expect(page.getByText('Consultazione offline', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prepariamo le interviste.' })).toBeVisible();
    await page.goto(`/backoffice/speaker/${id}/note`);
    await expect(
      page.getByText('Approfondimento mai aperto prima del download.', { exact: true })
    ).toBeVisible();
    await page.goto(`/speaker/${id}`);
    await expect(page.getByRole('button', { name: 'Assegna / cambia' })).toBeDisabled();
    await page.getByRole('button', { name: 'Avvia intervista', exact: true }).first().click();
    await expect(page.getByRole('region', { name: 'Modalità intervista' })).toBeVisible();
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByText('Offline question 1', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Prossima domanda' }).click();
    await expect(page.getByText('Offline question 2', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('offline-interview.png') });
    await page.goto(`/backoffice/speaker/${id}/intervista`);
    await expect(page.getByRole('button', { name: 'Vota 1 su 5' }).first()).toBeDisabled();
    expect(errors).toEqual([]);
    // Revocation is checked before revealing local data after reconnecting.
    await page.route('**/api/access', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Accesso revocato' })
      })
    );
    await context.setOffline(false);
    await expect(page.getByRole('heading', { name: 'Accesso non abilitato' })).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('Approfondimento mai aperto prima del download.')).toHaveCount(0);
    await expect(
      page
        .getByRole('button', { name: 'Accedi con Google' })
        .or(page.getByRole('heading', { name: 'Accesso non abilitato' }))
    ).toBeVisible();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
