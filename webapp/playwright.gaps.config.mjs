import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',testMatch:process.env.CALENDAR_GAP_REGRESSION ? ['calendar-gaps.spec.mjs','daily-loop.spec.mjs'] : 'calendar-gaps.spec.mjs',fullyParallel:false,workers:1,retries:0,reporter:'list',
  outputDir:'../output/playwright/calendar-gaps',
  use:{baseURL:'http://127.0.0.1:3147',trace:'retain-on-failure',serviceWorkers:'block'},
  projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},
    {name:'mobile-chromium',use:{...devices['iPhone 13'],browserName:'chromium',viewport:{width:390,height:844}}}],
  webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3147',url:'http://127.0.0.1:3147/join?coach_invite=health-check',
    reuseExistingServer:false,timeout:120000,env:{PLAYWRIGHT_TEST:'1',NEXT_TELEMETRY_DISABLED:'1',
      NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-only'}},
});
