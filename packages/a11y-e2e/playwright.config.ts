import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGIN_APP_TARGETS, loginPreviewUrl } from "./src/login-apps.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");
const isCi = process.env["CI"] === "true" || process.env["CI"] === "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  ...(isCi ? { workers: 1 as const } : {}),
  reporter: isCi ? "github" : "list",
  timeout: 60_000,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: LOGIN_APP_TARGETS.map((app) => ({
    command: `pnpm --filter ${app.packageName} build && pnpm --filter ${app.packageName} exec vite preview --port ${app.previewPort} --strictPort --host 127.0.0.1`,
    url: loginPreviewUrl(app.previewPort),
    cwd: repoRoot,
    reuseExistingServer: !isCi,
    timeout: 240_000,
  })),
});
