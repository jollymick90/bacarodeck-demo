import { test, expect } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

let server: ViteDevServer;
let fixtureUrl: string;
test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    plugins: [svelte({ configFile: false })],
    server: { host: '127.0.0.1', port: 0, hmr: false }
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start');
  fixtureUrl = `http://127.0.0.1:${address.port}/tests/fixtures/notice/index.html`;
});
test.afterAll(async () => {
  await server?.close();
});

test('notice expires on time despite parent callback updates and shows its countdown', async ({
  page
}) => {
  await page.clock.install();
  await page.goto(fixtureUrl);
  const notice = page.getByRole('status');
  await expect(notice).toContainText('Modifiche salvate.');
  await page.clock.pauseAt(new Date());
  await page.clock.runFor(5100);
  await expect(notice).toHaveCount(0);
  await page.getByRole('button', { name: 'Nuova notifica', exact: true }).click();
  await expect(notice).toContainText('3 s');
  await page.clock.runFor(1000);
  await expect(notice).toContainText('2 s');
  await page.clock.runFor(1000);
  await expect(notice).toContainText('1 s');
  await page.clock.runFor(1100);
  await expect(notice).toHaveCount(0);
});
