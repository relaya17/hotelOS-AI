import { expect, test } from "@playwright/test";

test.describe("www lead form", () => {
  test("submits to POST /v1/leads and shows success", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hotelos.cookieConsent.v2026.1");
    });

    let posted: unknown;
    await page.route("**/v1/leads", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            id: "00000000-0000-4000-8000-000000000099",
            createdAt: "2026-08-04T12:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("http://127.0.0.1:4177/#contact");

    await page.locator('input[name="name"]').fill("Dana Cohen");
    await page.locator('input[name="hotel"]').fill("Coastal Hotels");
    await page.locator('input[name="email"]').fill("dana@example.com");
    await page.locator('textarea[name="note"]').fill("Pilot interest");

    await page.getByRole("button", { name: "שליחה" }).click();

    await expect(page.getByRole("status")).toContainText(/קיבלנו את הפרטים/);
    expect(posted).toMatchObject({
      name: "Dana Cohen",
      hotelOrChain: "Coastal Hotels",
      email: "dana@example.com",
      note: "Pilot interest",
      source: "www_contact",
    });
  });

  test("shows error and mailto backup when API fails", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hotelos.cookieConsent.v2026.1");
    });

    await page.route("**/v1/leads", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
        }),
      });
    });

    await page.goto("http://127.0.0.1:4177/#contact");

    await page.locator('input[name="name"]').fill("Dana Cohen");
    await page.locator('input[name="hotel"]').fill("Coastal Hotels");
    await page.locator('input[name="email"]').fill("dana@example.com");
    await page.getByRole("button", { name: "שליחה" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /פתיחת מייל כגיבוי/ }),
    ).toBeVisible();
  });
});
