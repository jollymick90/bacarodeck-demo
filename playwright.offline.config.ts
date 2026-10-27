import base from './playwright.config';
import { defineConfig } from '@playwright/test';
const port = Number(process.env.TEST_PORT || '4273');
const backend = `http://127.0.0.1:${port + 1}`;
const env = !Array.isArray(base.webServer) ? base.webServer?.env : {};
export default defineConfig({
  ...base,
  testMatch: 'offline.spec.ts',
  timeout: 90000,
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: [
    // Real authorized emulator APIs stay on a development server; production's
    // prohibition on Admin emulator use remains unchanged.
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${port + 1}`,
      url: backend,
      reuseExistingServer: false,
      env
    },
    {
      command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...env,
        BACARODECK_TEST_API_ORIGIN: backend,
        FIREBASE_AUTH_EMULATOR_HOST: '',
        FIRESTORE_EMULATOR_HOST: ''
      }
    }
  ]
});
