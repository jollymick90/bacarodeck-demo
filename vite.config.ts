import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig(({ command }) => ({
  plugins: [sveltekit()],
  // Transform sanitize-html's CommonJS wrapper into ESM during SSR bundling.
  // Vercel's runtime cannot reliably require() its ESM-only htmlparser2 dependency.
  ssr: {
    noExternal: command === 'build' ? ['sanitize-html', 'htmlparser2', 'is-plain-object'] : []
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.FIRESTORE_EMULATOR_HOST ? [] : ['tests/rules.test.ts']
  }
}));
