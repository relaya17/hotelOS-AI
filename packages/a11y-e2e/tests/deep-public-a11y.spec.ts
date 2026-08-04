import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  formatBlockingViolations,
  listBlockingViolations,
} from "../src/axe-helpers.js";

const PRIVACY_STUB = {
  data: {
    id: "privacy",
    titleHe: "מדיניות פרטיות",
    titleEn: "Privacy Policy",
    version: "2026.1",
    updatedAt: "2026-08-04T00:00:00.000Z",
    sections: [
      {
        heading: "מבוא",
        body: "HotelOS AI מעבדת נתונים תפעוליים לפי תפקיד ולפי הסכמה.",
      },
    ],
  },
};

test.describe("deep public paths", () => {
  test("axe: Work invite shell", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hotelos.cookieConsent.v2026.1");
    });

    await page.goto("http://127.0.0.1:4176/?invite=axe-probe");

    await expect(
      page.getByRole("heading", { name: /השלמת הרשמה/ }),
    ).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".cookie-banner")
      .analyze();

    const blocking = listBlockingViolations(results);
    expect(
      blocking,
      blocking.length > 0
        ? `work invite violations:\n${formatBlockingViolations(blocking)}`
        : undefined,
    ).toEqual([]);
  });

  test("axe: Guest legal privacy stub", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hotelos.cookieConsent.v2026.1");
    });

    await page.route("**/v1/public/legal/privacy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PRIVACY_STUB),
      });
    });

    await page.goto("http://127.0.0.1:4175/?doc=privacy");

    await expect(
      page.getByRole("heading", { name: /מדיניות פרטיות|Privacy/i }),
    ).toBeVisible({ timeout: 30_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude(".cookie-banner")
      .analyze();

    const blocking = listBlockingViolations(results);
    expect(
      blocking,
      blocking.length > 0
        ? `guest privacy violations:\n${formatBlockingViolations(blocking)}`
        : undefined,
    ).toEqual([]);
  });
});
