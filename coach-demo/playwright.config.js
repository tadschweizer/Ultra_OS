import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./browser",
  timeout: 45000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.DEMO_BASE_URL || "http://127.0.0.1:4173",
    launchOptions: {
      executablePath:
        process.env.DEMO_CHROME ||
        "C:/Users/BAS/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe",
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.DEMO_BASE_URL
    ? undefined
    : {
        command: "npx vite preview --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: true,
      },
});
