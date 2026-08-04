#!/usr/bin/env node
/**
 * Stage ג׳ — Playwright + axe on staff login + public + secured shells.
 *
 * Skips gracefully when Chromium is not installed (local dev without browsers).
 * Set RUN_A11Y_E2E=1 to fail instead of skip when browsers are missing.
 * Set SKIP_A11Y_E2E=1 to always skip (e.g. constrained CI matrix).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");

if (process.env.SKIP_A11Y_E2E === "1") {
  console.log("SKIP_A11Y_E2E=1 — skipping Playwright axe login tests");
  process.exit(0);
}

async function chromiumReady() {
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

function runPlaywright() {
  const playwrightBin = join(
    pkgRoot,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  );
  const result = spawnSync(process.execPath, [playwrightBin, "test"], {
    cwd: pkgRoot,
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const ready = await chromiumReady();
if (!ready) {
  const msg =
    "Playwright Chromium not installed — skipping login axe E2E. Run: pnpm --filter @hotelos/a11y-e2e install:browsers";
  if (process.env.RUN_A11Y_E2E === "1") {
    console.error(`${msg}\n(set RUN_A11Y_E2E=1 — treating missing browsers as failure)`);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

runPlaywright();
