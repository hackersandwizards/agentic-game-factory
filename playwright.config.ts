import { defineConfig } from "@playwright/test";
import { launchOptions } from "./tests/chrome";

export default defineConfig({
  forbidOnly: true,
  testDir: ".",
  testMatch: "{tests,examples}/**/*.spec.ts",
  reporter: "list",
  use: { headless: true, launchOptions },
  webServer: {
    command: "bun --no-env-file scripts/preview.mjs",
    wait: { stdout: /Preview listening on (?<PLAYWRIGHT_TEST_BASE_URL>http:\/\/127\.0\.0\.1:\d+)/ },
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
