import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGIN_APP_TARGETS, loginPreviewUrl } from "./src/login-apps.js";
import { PUBLIC_APP_TARGETS, publicPreviewUrl } from "./src/public-apps.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");
const isCi = process.env["CI"] === "true" || process.env["CI"] === "1";

const previewTargets = [
  ...LOGIN_APP_TARGETS.map((app) => ({
    packageName: app.packageName,
    previewPort: app.previewPort,
    url: loginPreviewUrl(app.previewPort),
  })),
  ...PUBLIC_APP_TARGETS.map((app) => ({
    packageName: app.packageName,
    previewPort: app.previewPort,
    url: publicPreviewUrl(app.previewPort),
  })),
];

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
  webServer: previewTargets.map((app) => ({
    command: isCi
      ? `pnpm --filter ${app.packageName} exec vite preview --port ${app.previewPort} --strictPort --host 127.0.0.1`
      : `pnpm --filter ${app.packageName} build && pnpm --filter ${app.packageName} exec vite preview --port ${app.previewPort} --strictPort --host 127.0.0.1`,
    url: app.url,
    cwd: repoRoot,
    reuseExistingServer: !isCi,
    timeout: 240_000,
  })),
});
