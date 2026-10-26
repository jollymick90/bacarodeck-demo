import { test, expect } from '@playwright/test';
import { briefId } from '../../src/lib/conductor/brief';

test('optional questions are shared, ordered before the closing question and skippable', async ({
  page,
  request
}, info) => {
  const id = `optional-interview-${info.project.name}-${Date.now()}`;
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Viewport fallback'));
  });
  await page.goto('/');
  const access = page.waitForRequest('**/api/access');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google' }).click();
  const popup = await popupPromise;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
  await popup.getByLabel('Display name').fill('Optional interview test');
  await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  const headers = { Authorization: (await access).headers().authorization };
  const result = await request.post('/api/data', {
    headers,
    data: {
      action: 'save',
      changes: [
        { collection: 'speakers', data: { id, fullName: 'Optional interview speaker' } },
        ...[1, 2, 3, 4, 5].map((n) => ({
          collection: 'questions',
          data: {
            id: `${id}-q${n}`,
            speakerId: id,
            textIt: `Domanda test ${n}?`,
            textEn: `Test question ${n}?`,
            order: n,
            status: 'suggested'
          }
        }))
      ].map((change) => ({ ...change, expectedRevision: null }))
    }
  });
  expect(result.ok(), await result.text()).toBe(true);
  const saved = await request.post('/api/conductor/brief', {
    headers,
    data: {
      brief: {
        id: briefId(id),
        speakerId: id,
        mainQuestionIds: [1, 2, 3].map((n) => `${id}-q${n}`),
        summaryIt: 'Sintesi da preservare'
      },
      expectedRevision: null
    }
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  try {
    await page.goto(`/backoffice/speaker/${id}/intervista`);
    const primary = page.getByRole('region', { name: 'Domande per intervista', exact: true });
    const optional = page.getByRole('region', { name: 'Domande opzionali', exact: true });
    const others = page.getByRole('region', { name: 'Altre domande', exact: true });
    for (const n of [5, 4]) {
      await others
        .locator('article')
        .filter({ has: page.getByRole('heading', { name: `Domanda test ${n}?`, exact: true }) })
        .getByRole('button', { name: 'Usa come opzionale', exact: true })
        .click();
      await expect(optional.locator('article')).toHaveCount(n === 5 ? 1 : 2);
    }
    await expect(primary.locator('article h3')).toHaveText([
      'Domanda test 1?',
      'Domanda test 2?',
      'Domanda test 3?'
    ]);
    await expect(optional.locator('article h3')).toHaveText(['Domanda test 5?', 'Domanda test 4?']);
    await optional
      .getByRole('button', { name: 'Sposta domanda opzionale 2 in alto', exact: true })
      .click();
    await expect(optional.locator('article h3')).toHaveText(['Domanda test 4?', 'Domanda test 5?']);
    await page.reload();
    await expect(optional.locator('article h3')).toHaveText(['Domanda test 4?', 'Domanda test 5?']);
    const brief = (await (await request.get('/api/data/conductorBriefs', { headers })).json()).find(
      (row: { id: string }) => row.id === briefId(id)
    );
    expect(brief.optionalQuestionIds).toEqual([`${id}-q4`, `${id}-q5`]);
    expect(brief.summaryIt).toBe('Sintesi da preservare');
    await page.goto(`/speaker/${id}/intervista?lang=en`);
    const viewer = page.getByRole('region', { name: 'Modalità intervista', exact: true });
    for (const n of [1, 2, 4, 5, 3]) {
      await expect(viewer).toContainText(`Test question ${n}?`);
      if (n === 4) {
        await expect(
          viewer.getByText('Domanda opzionale · se c’è tempo', { exact: true })
        ).toBeVisible();
        if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 390 });
        await expect(
          viewer.getByRole('button', { name: 'Vai alla domanda finale', exact: true })
        ).toBeInViewport();
        await expect(
          viewer.getByRole('button', { name: 'Prossima domanda', exact: true })
        ).toBeInViewport();
        await page.screenshot({ path: info.outputPath('optional-interview.png') });
        if (info.project.name === 'mobile') await page.setViewportSize({ width: 390, height: 844 });
      }
      if (n !== 3)
        await viewer.getByRole('button', { name: 'Prossima domanda', exact: true }).click();
    }
    await expect(
      viewer.getByRole('button', { name: 'Prossima domanda', exact: true })
    ).toBeDisabled();
    await page.goto(`/speaker/${id}/intervista?lang=en`);
    await viewer.getByRole('button', { name: 'Prossima domanda', exact: true }).click();
    await viewer.getByRole('button', { name: 'Vai alla domanda finale', exact: true }).click();
    await expect(viewer).toContainText('Test question 3?');
    await expect(viewer).not.toContainText('Test question 4?');
    await page.goto(`/speaker/${id}/scaletta?question=${id}-q4&lang=en`);
    await expect(page.locator('.interview-question')).toContainText('Test question 4?');
    await page.getByRole('link', { name: 'Avanti', exact: true }).click();
    await expect(page.locator('.interview-question')).toContainText('Test question 5?');
    await page.getByRole('link', { name: 'Vai alla domanda finale', exact: true }).click();
    await expect(page.locator('.interview-question')).toContainText('Test question 3?');
    // With just one main question, reading still starts with the selected extras.
    await page.goto(`/backoffice/speaker/${id}/intervista`);
    for (const n of [3, 2]) {
      await primary
        .locator('article')
        .filter({ has: page.getByRole('heading', { name: `Domanda test ${n}?`, exact: true }) })
        .getByRole('button', { name: 'Togli dall’intervista', exact: true })
        .click();
      await expect(primary.locator('article')).toHaveCount(n - 1);
    }
    await expect(optional.locator('article')).toHaveCount(2);
    await page.goto(`/speaker/${id}?lang=en`);
    await page.getByRole('link', { name: 'Usa la scaletta', exact: true }).click();
    await expect(page.locator('.interview-question')).toContainText('Test question 4?');
  } finally {
    for (const collection of ['conductorBriefs', 'questions', 'speakers']) {
      const rows = await (await request.get('/api/data/' + collection, { headers })).json();
      const records = rows.filter(
        (row: { id: string; speakerId?: string }) => row.id === id || row.speakerId === id
      );
      if (records.length) {
        const removed = await request.post('/api/data', {
          headers,
          data: {
            action: 'delete',
            changes: records.map((data: { revision: number }) => ({
              collection,
              data,
              expectedRevision: data.revision
            }))
          }
        });
        expect(removed.ok(), await removed.text()).toBe(true);
      }
    }
  }
});
