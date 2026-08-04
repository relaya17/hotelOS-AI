import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  formatBlockingViolationsDetailed,
  listBlockingViolations,
} from "../src/axe-helpers.js";
import { LOGIN_APP_TARGETS, loginPreviewUrl } from "../src/login-apps.js";
import {
  installSecuredApiStubs,
  seedStubSession,
} from "../src/secured-stubs.js";

type SecuredTarget = {
  readonly id: (typeof LOGIN_APP_TARGETS)[number]["id"];
  readonly path: string;
  readonly ready: RegExp;
};

const SECURED_TARGETS: readonly SecuredTarget[] = [
  {
    id: "admin",
    path: "/?panel=approvals",
    ready: /תיבת אישורי AI/,
  },
  {
    id: "admin",
    path: "/?panel=hr",
    ready: /משאבי אנוש/,
  },
  {
    id: "admin",
    path: "/",
    ready: /חדרים|הזמנות|מלון פעיל/,
  },
  {
    id: "executive",
    path: "/#approvals",
    ready: /אישורי AI ממתינים/,
  },
  {
    id: "executive",
    path: "/#portfolio",
    ready: /לוח בקרה לרשת|Demo Tenant|מלונות ברשת/,
  },
  {
    id: "work",
    path: "/",
    ready: /שעון משמרת/,
  },
];

function previewPortFor(id: SecuredTarget["id"]): number {
  const app = LOGIN_APP_TARGETS.find((target) => target.id === id);
  if (!app) {
    throw new Error(`Unknown login app: ${id}`);
  }
  return app.previewPort;
}

for (const target of SECURED_TARGETS) {
  const caseName = `${target.id}${target.path === "/" ? "" : ` ${target.path}`}`;
  test.describe(`${caseName} secured shell`, () => {
    test("axe: authenticated view has no serious/critical WCAG violations", async ({
      page,
    }) => {
      await seedStubSession(page);
      await installSecuredApiStubs(page);

      const url = `${loginPreviewUrl(previewPortFor(target.id)).replace(/\/$/, "")}${target.path}`;
      await page.goto(url);

      await expect(page.getByText(target.ready).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator("#main-content")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude(".cookie-banner")
        .analyze();

      const blocking = listBlockingViolations(results);
      expect(
        blocking,
        blocking.length > 0
          ? `${caseName} secured violations:\n${formatBlockingViolationsDetailed(results)}`
          : undefined,
      ).toEqual([]);
    });
  });
}
