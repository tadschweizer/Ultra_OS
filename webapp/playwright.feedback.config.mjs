import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'site-review.spec.mjs',workers:1,retries:0,
 use:{baseURL:'http://127.0.0.1:3127',trace:'retain-on-failure'},
 projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['iPhone 13'],browserName:'chromium'}}],
 webServer:{command:'npm run dev -- --webpack --hostname 127.0.0.1 --port 3127',url:'http://127.0.0.1:3127/privacy',reuseExistingServer:false,timeout:120000,env:{XDG_CONFIG_HOME:process.cwd()+'/.test-config',PLAYWRIGHT_TEST:'1',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test'}}
});
