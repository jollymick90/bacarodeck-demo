import { test, expect } from '@playwright/test';
import type { GraphResponse } from '../../src/lib/connections/types';

// UI contract coverage only. Model quality and real persistence are tested separately.
for (const fallback of [true, false])
  test(`connections navigation and ${fallback ? 'WebGL fallback' : 'real 3D rendering'}`, async ({
    page,
    context
  }, info) => {
    let authorization = '';
    page.on('request', (request) => {
      const header = request.headers()['authorization'];
      if (header) authorization = header;
    });
    const graph: GraphResponse = {
      nodes: [
        {
          id: 'speaker:ui-a',
          kind: 'speaker',
          entityId: 'ui-a',
          label: 'Speaker prova connessioni',
          href: '/speaker/ui-a',
          text: '',
          evidence: []
        },
        {
          id: 'topic:ui-ai',
          kind: 'topic',
          entityId: 'ui-ai',
          label: 'Valutazione agenti',
          href: '/topic/AI',
          text: '',
          evidence: []
        }
      ],
      edges: [
        {
          id: 'ui-edge',
          source: 'speaker:ui-a',
          target: 'topic:ui-ai',
          kind: 'speaker-topic',
          origin: 'automatic',
          reason: 'Entrambi trattano la verifica degli agenti.',
          score: 0.81,
          evidence: [
            {
              collection: 'speakers',
              id: 'ui-a',
              excerpt: 'Misurare il comportamento degli agenti.'
            }
          ]
        }
      ],
      overrides: [],
      status: { state: 'ready' },
      model: 'UI fixture (no model execution)',
      stale: true
    };
    const decisions: Record<string, unknown>[] = [];
    await page.route('**/api/connections', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        decisions.push(body);
        if (body.decision === 'confirmed') {
          graph.edges[0].origin = 'confirmed';
          graph.overrides = [
            {
              id: 'ui-edge',
              source: body.source,
              target: body.target,
              kind: body.kind,
              decision: 'confirmed',
              revision: 7
            }
          ];
        }
        await route.fulfill({ json: { ok: true } });
      } else await route.fulfill({ json: graph });
    });
    if (fallback)
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ) {
          if (type.startsWith('webgl')) return null;
          return original.apply(this, [type, ...args] as Parameters<typeof original>);
        } as typeof original;
      });
    await page.goto('/topic/connessioni?node=speaker%3Aui-a&view=list');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Accedi con Google' }).click();
    const popup = await popupPromise;
    await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.getByLabel('Email').fill(`editor-${info.project.name}@example.test`);
    await popup.getByLabel('Display name').fill('Connessioni UI');
    await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Connessioni', exact: true })).toBeVisible();
    await expect(
      page.getByText('I risultati automatici mostrati sono da aggiornare.')
    ).toBeVisible();
    await expect(
      page.getByText('È un punteggio di similarità, non una probabilità.', { exact: false })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Conferma', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Conferma', exact: true })).toBeDisabled();
    expect(decisions[0]).toMatchObject({
      action: 'decision',
      expectedRevision: null,
      decision: 'confirmed'
    });
    await page.getByRole('button', { name: 'Annulla decisione' }).click();
    await expect.poll(() => decisions.length).toBe(2);
    expect(decisions[1]).toMatchObject({ expectedRevision: 7, decision: 'reset' });
    await page.getByRole('button', { name: 'Espandi a due passaggi' }).click();
    await expect(page).toHaveURL(/depth=2/);
    await page.getByRole('button', { name: '3D', exact: true }).click();
    if (fallback) {
      await expect(page.getByText('La vista 3D non è disponibile', { exact: false })).toBeVisible();
    } else {
      const canvas = page.locator('.graph-canvas canvas');
      await expect(canvas).toBeVisible();
      const rect = await canvas.boundingBox();
      expect(rect?.width).toBeGreaterThan(200);
      await page.screenshot({
        path: `.superpowers/connections/3d-${info.project.name}.png`,
        fullPage: true
      });
      await canvas.hover();
      await page.mouse.wheel(0, 100);
      await expect(canvas).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Collegamenti (1)' })).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Scarta', exact: true })).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Speaker prova connessioni' })).toBeVisible();
    await context.setOffline(false);
    await page.getByLabel('Cerca nodi').fill('Valutazione');
    await expect(page).toHaveURL(/q=Valutazione/);
    await page.reload();
    await expect(page.getByLabel('Cerca nodi')).toHaveValue('Valutazione');
    if (!fallback) {
      // Exercise the real authenticated API and model worker (no UI response fixture).
      await page.unroute('**/api/connections');
      expect(authorization).toBeTruthy();
      const headers = { Authorization: authorization };
      let actual: GraphResponse;
      await expect
        .poll(
          async () => {
            const response = await page.request.get('/api/connections', { headers });
            expect(response.status()).toBe(200);
            actual = await response.json();
            return actual.status.state;
          },
          { timeout: 30000 }
        )
        .toBe('ready');
      const [a, b] = actual!.nodes.filter((n) => n.kind === 'topic');
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      const body = {
        action: 'decision',
        source: a.id,
        target: b.id,
        kind: 'topic-related',
        decision: 'linked',
        expectedRevision: null
      };
      const saved = await page.request.post('/api/connections', { headers, data: body });
      expect(saved.status()).toBe(200);
      const conflict = await page.request.post('/api/connections', { headers, data: body });
      expect(conflict.status()).toBe(409);
      const read = await page.request.get('/api/connections', { headers });
      const updated: GraphResponse = await read.json();
      const decision = updated.overrides.find(
        (item) =>
          (item.source === a.id && item.target === b.id) ||
          (item.source === b.id && item.target === a.id)
      )!;
      expect(decision.decision).toBe('linked');
      const reset = await page.request.post('/api/connections', {
        headers,
        data: { ...body, decision: 'reset', expectedRevision: decision.revision }
      });
      expect(reset.status()).toBe(200);
    }
  });
