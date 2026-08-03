import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  formatBlockingViolations,
  listBlockingViolations,
} from "../src/axe-helpers.js";
import { LOGIN_APP_TARGETS, loginPreviewUrl } from "../src/login-apps.js";

for (const app of LOGIN_APP_TARGETS) {
  test.describe(`${app.id} login screen`, () => {
    test("axe: no serious/critical WCAG violations", async ({ page }) => {
      await page.addInitScript(() => {
        sessionStorage.clear();
        localStorage.removeItem("hotelos.accessToken");
        localStorage.removeItem("hotelos.refreshToken");
        localStorage.removeItem("hotelos.user");
        localStorage.removeItem("hotelos.cookieConsent.v2026.1");
      });

      await page.goto(loginPreviewUrl(app.previewPort));

      await expect(
        page.getByRole("heading", { name: app.loginHeading, level: 2 }),
      ).toBeVisible({ timeout: 30_000 });

      await expect(page.locator("#main-content")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const blocking = listBlockingViolations(results);
      expect(
        blocking,
        blocking.length > 0
          ? `${app.id} login violations:\n${formatBlockingViolations(blocking)}`
          : undefined,
      ).toEqual([]);
    });
  });
}
