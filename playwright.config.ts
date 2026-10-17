import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', ignoreHTTPSErrors: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: {
      PUBLIC_FIREBASE_API_KEY: 'fake-emulator-key',
      PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-bacarodeck.firebaseapp.com',
      PUBLIC_FIREBASE_PROJECT_ID: 'demo-bacarodeck',
      PUBLIC_FIREBASE_APP_ID: 'demo-app',
      PUBLIC_USE_EMULATORS: 'true',
      ALLOW_LIST: 'editor-desktop@example.test,editor-mobile@example.test',
      SUPERADMIN_EMAILS: 'editor-desktop@example.test',
      FIREBASE_ADMIN_KEY: ''
    }
  }
});
