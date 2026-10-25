import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { it, expect } from 'vitest';
import config from '../vite.config';

it('renders sanitized Markdown from the SSR bundle without require(ESM) support', async () => {
  const directory = await mkdtemp(resolve('.markdown-runtime-'));
  try {
    await build({
      configFile: false,
      logLevel: 'silent',
      ssr: (await config({ command: 'build', mode: 'production' })).ssr,
      build: {
        ssr: resolve('src/lib/domain.ts'),
        outDir: directory,
        minify: false,
        rollupOptions: { output: { entryFileNames: 'domain.mjs' } }
      }
    });
    const script = `
      import { renderMarkdown } from ${JSON.stringify(pathToFileURL(resolve(directory, 'domain.mjs')).href)};
      console.log(renderMarkdown('**Nota** <script>alert(1)</script><a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)>'));
    `;
    const html = execFileSync(
      process.execPath,
      ['--no-experimental-require-module', '--input-type=module', '-e', script],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );
    expect(html).toContain('<strong>Nota</strong>');
    expect(html).not.toMatch(/<script|javascript:|onerror=|<img/i);
    expect(html).toContain('link</a>');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
