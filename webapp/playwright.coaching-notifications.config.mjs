import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'coaching-notifications.spec.mjs', workers: 1, retries: 0, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3016', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3016', url: 'http://127.0.0.1:3016/notifications', reuseExistingServer: false, timeout: 120000,
    env: { PLAYWRIGHT_TEST: '1', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test', NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3016' },
  },
});
