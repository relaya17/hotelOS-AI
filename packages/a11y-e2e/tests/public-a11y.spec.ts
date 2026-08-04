import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  formatBlockingViolationsDetailed,
  listBlockingViolations,
} from "../src/axe-helpers.js";
import { PUBLIC_APP_TARGETS, publicPreviewUrl } from "../src/public-apps.js";

for (const app of PUBLIC_APP_TARGETS) {
  test.describe(`${app.id} public shell`, () => {
    test("axe: no serious/critical WCAG violations", async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.removeItem("hotelos.cookieConsent.v2026.1");
      });

      await page.goto(publicPreviewUrl(app.previewPort));

      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 30_000,
      });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude(".cookie-banner")
        .analyze();

      const blocking = listBlockingViolations(results);
      expect(
        blocking,
        blocking.length > 0
          ? `${app.id} public violations:\n${formatBlockingViolationsDetailed(results)}`
          : undefined,
      ).toEqual([]);
    });
  });
}
