import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "test/e2e",
  outputDir: "build/test-results/e2e",
  preserveOutput: "failures-only",
  reporter: "list",
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
})
