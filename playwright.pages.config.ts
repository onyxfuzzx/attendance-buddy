import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/pages",
  outputDir: "test-results/pages",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4174/attendance-buddy/",
    viewport: { width: 1440, height: 1050 },
    launchOptions: process.env.CI ? {} : { channel: "chrome" },
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "npm run preview:pages",
    url: "http://127.0.0.1:4174/attendance-buddy/",
    reuseExistingServer: !process.env.CI,
  },
});
