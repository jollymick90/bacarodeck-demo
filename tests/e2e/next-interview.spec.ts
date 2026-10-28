import { test, expect, type Page } from '@playwright/test';

test('the next interview is shared, unique, protected from stale changes and cleared on completion', async ({
  page,
  browser,
  request,
  baseURL
}, info) => {
  const id = `next-interview-${info.project.name}-${Date.now()}`;
  async function login(target: Page, email: string) {
    await target.goto('/');
    const access = target.waitForRequest('**/api/access');
    const popupPromise = target.waitForEvent('popup');
    await target.getByRole('button', { name: 'Accedi con Google', exact: true }).click();
    const popup = await popupPromise;
    await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.getByLabel('Email').fill(email);
    await popup.getByLabel('Display name').fill('Next interview test');
    await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
    const headers = { Authorization: (await access).headers().authorization };
    await expect(
      target.getByRole('heading', { name: 'Chi intervistiamo?', exact: true })
    ).toBeVisible();
    return headers;
  }
  const headers = await login(page, `editor-${info.project.name}@example.test`);
  const created = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        {
          collection: 'speakers',
          data: { id: `${id}-a`, fullName: 'Prossimo speaker A', inInterviewList: false }
        },
        {
          collection: 'speakers',
          data: { id: `${id}-b`, fullName: 'Prossimo speaker B', inInterviewList: true }
        },
        {
          collection: 'interviewPlans',
          data: {
            id: `${id}-plan-a`,
            speakerId: `${id}-a`,
            interviewStatus: 'confirmed',
            notesMd: 'Note da preservare',
            cameraId: 'lorenzo'
          }
        }
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(created.ok(), await created.text()).toBe(true);
  const colleagueContext = await browser.newContext({ baseURL });
  try {
    await page.goto(`/speaker/${id}-a`);
    const choose = page.getByRole('button', { name: 'Segna come prossimo', exact: true });
    await expect(choose).toBeVisible();
    await choose.click();
    await expect(
      page.getByRole('button', { name: 'Togli da prossimo', exact: true })
    ).toBeVisible();
    const selectedSpeaker = (
      await (await request.get('/api/data/speakers', { headers })).json()
    ).find((s: { id: string }) => s.id === `${id}-a`);
    for (const action of ['delete', 'save']) {
      const response = await request.post('/api/data', {
        headers,
        data: {
          action,
          changes: [
            {
              collection: 'speakers',
              expectedRevision: selectedSpeaker.revision,
              data: action === 'save' ? { ...selectedSpeaker, status: 'archived' } : selectedSpeaker
            }
          ]
        }
      });
      expect(response.status()).toBe(400);
    }
    await page.goto('/');
    const banner = page.getByRole('region', { name: 'Prossima intervista', exact: true });
    await expect(banner).toContainText('Prossimo speaker A');
    await page
      .getByRole('searchbox', { name: 'Cerca speaker', exact: true })
      .fill('nessun risultato');
    await expect(banner).toContainText('Prossimo speaker A');
    await expect(banner.getByRole('link', { name: 'Apri scheda', exact: true })).toHaveAttribute(
      'href',
      `/speaker/${id}-a`
    );
    const plans = async () =>
      await (await request.get('/api/data/interviewPlans', { headers })).json();
    const stalePlans = await plans();
    await page.route('**/api/data/interviewPlans', (route) => route.fulfill({ json: stalePlans }));

    const colleague = await colleagueContext.newPage();
    const colleagueHeaders = await login(
      colleague,
      info.project.name === 'desktop' ? 'editor-mobile@example.test' : 'editor-desktop@example.test'
    );
    await expect(
      colleague.getByRole('region', { name: 'Prossima intervista', exact: true })
    ).toContainText('Prossimo speaker A');
    await colleague.goto(`/speaker/${id}-b`);
    await colleague.getByRole('button', { name: 'Segna come prossimo', exact: true }).click();
    await expect(
      colleague.getByRole('button', { name: 'Togli da prossimo', exact: true })
    ).toBeVisible();
    // This page still holds the old revisions: it must not clear the colleague's choice.
    await banner.getByRole('button', { name: 'Togli da prossimo', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Conflitto');
    await page.unroute('**/api/data/interviewPlans');
    await expect(banner).toContainText('Prossimo speaker B', { timeout: 10000 });
    const a = (await plans()).find((p: { speakerId: string }) => p.speakerId === `${id}-a`);
    expect(a).toMatchObject({
      nextInterview: false,
      interviewStatus: 'confirmed',
      notesMd: 'Note da preservare',
      cameraId: 'lorenzo'
    });
    const invalid = await request.post('/api/data', {
      headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'interviewPlans',
            data: { ...a, nextInterview: true },
            expectedRevision: a.revision
          }
        ]
      }
    });
    expect(invalid.status()).toBe(409);
    const invalidRestore = await request.post('/api/backup', {
      headers: info.project.name === 'desktop' ? headers : colleagueHeaders,
      data: {
        changes: [
          {
            collection: 'interviewPlans',
            id: a.id,
            expected: a,
            data: { ...a, nextInterview: true }
          }
        ]
      }
    });
    expect(invalidRestore.status()).toBe(409);
    expect((await plans()).filter((p: { nextInterview: boolean }) => p.nextInterview)).toHaveLength(
      1
    );
    await page.reload();
    await expect(banner).toContainText('Prossimo speaker B');
    await page.screenshot({ path: info.outputPath('next-interview.png') });
    await banner.getByRole('button', { name: 'Togli da prossimo', exact: true }).click();
    await expect(banner).toContainText('Nessuno speaker indicato');

    await page.goto(`/speaker/${id}-a`);
    await choose.click();
    await expect(
      page.getByRole('button', { name: 'Togli da prossimo', exact: true })
    ).toBeVisible();
    const completion = page.getByRole('group', { name: 'Stato intervista', exact: true });
    await completion.getByRole('button', { name: 'Intervista fatta', exact: true }).click();
    await expect(completion.getByText('Intervista fatta', { exact: true })).toBeVisible();
    await expect(choose).toBeDisabled();
    const completed = (await plans()).find((p: { speakerId: string }) => p.speakerId === `${id}-a`);
    expect(completed).toMatchObject({
      nextInterview: false,
      interviewStatus: 'completed',
      notesMd: 'Note da preservare'
    });
    await completion.getByRole('button', { name: 'Segna da intervistare', exact: true }).click();
    await expect(choose).toBeEnabled();
    await page.goto('/');
    await expect(banner).toContainText('Nessuno speaker indicato');
  } finally {
    await colleagueContext.close();
    for (const collection of ['interviewPlans', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter((row: { id: string }) => row.id.startsWith(id));
      if (records.length)
        expect(
          (
            await request.post('/api/data', {
              headers,
              data: {
                action: 'delete',
                changes: records.map((data: { revision: number }) => ({
                  collection,
                  data,
                  expectedRevision: data.revision
                }))
              }
            })
          ).ok()
        ).toBe(true);
    }
  }
});
