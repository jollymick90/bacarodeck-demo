import { accessConfiguration } from './src/lib/assignees';
import { defineConfig, devices } from '@playwright/test';
const testPort = process.env.TEST_PORT || '4173';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${testPort}`,
    url: `http://127.0.0.1:${testPort}`,
    reuseExistingServer: false,
    env: {
      PUBLIC_FIREBASE_API_KEY: 'fake-emulator-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-bacarodeck.firebaseapp.com',
      PUBLIC_FIREBASE_PROJECT_ID: 'demo-bacarodeck',
      PUBLIC_FIREBASE_APP_ID: 'demo-app',
      PUBLIC_USE_EMULATORS: 'true',
      PUBLIC_AUTH_EMULATOR_URL:
        'http://' + (process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'),
      PUBLIC_FIRESTORE_EMULATOR_PORT: (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080')
        .split(':')
        .pop()!,
      ALLOW_LIST:
        'editor-desktop@example.test,editor-mobile@example.test,' +
        accessConfiguration({}).configured,
      SUPERADMIN_EMAILS: 'editor-desktop@example.test',
      FIREBASE_ADMIN_KEY: ''
    }
  }
});
