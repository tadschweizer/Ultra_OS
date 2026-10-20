import base from './playwright.config.mjs';

export default {
  ...base,
  timeout: 45000,
  use: { ...base.use, baseURL: 'http://127.0.0.1:3040' },
  webServer: {
    command: process.env.PUBLIC_INTERFACE_USE_BUILD === '1'
      ? 'npm run start -- --hostname 127.0.0.1 --port 3040'
      : 'npm run dev -- --webpack --hostname 127.0.0.1 --port 3040',
    url: 'http://127.0.0.1:3040',
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      PLAYWRIGHT_TEST: '1',
      NEXT_PUBLIC_ATHLETE_OPEN_ACCESS: process.env.PUBLIC_INTERFACE_PAID_MODE === '1' ? 'false' : 'true',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-test-placeholder',
    },
  },
};
