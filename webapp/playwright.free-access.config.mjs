import base from './playwright.config.mjs';
export default { ...base, testMatch: 'free-athlete-access.spec.mjs',
  use: { ...base.use, baseURL: 'http://127.0.0.1:3020' },
  webServer: { command: 'npm run dev -- --hostname 127.0.0.1 --port 3020', url: 'http://127.0.0.1:3020', reuseExistingServer: false, timeout: 120000,
    env: { NEXT_PUBLIC_ATHLETE_OPEN_ACCESS: 'true', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-build-placeholder' } },
};
