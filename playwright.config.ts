import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: "**/pages/**",
  outputDir: "test-results/app",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CI ? {} : { channel: "chrome" },
    trace: "retain-on-failure",
  },
  reporter: "list",
  webServer: {
    command: "npm run dev",
    env: {
      VITE_SUPABASE_URL: "https://attendance-buddy-test.supabase.co",
      VITE_SUPABASE_ANON_KEY: "sb_publishable_browser_regression_test",
    },
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
