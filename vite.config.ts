import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: process.env.FIRESTORE_EMULATOR_HOST ? [] : ['tests/rules.test.ts']
  }
});
