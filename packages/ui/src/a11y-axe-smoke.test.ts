import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tokens = readFileSync(join(here, "styles", "tokens.css"), "utf8");
const axeSource = readFileSync(require.resolve("axe-core/axe.js"), "utf8");

type AxeViolation = {
  readonly id: string;
  readonly help: string;
  readonly impact?: string | null;
};

/**
 * Stage ג׳ — axe-core smoke on a minimal shell (skip-link + main landmark).
 * Runs axe inside JSDOM (no Node navigator overwrite).
 */
describe("a11y axe smoke (Vol. 4 / WCAG 2.2)", () => {
  it("flags no serious/critical issues on the skip-link shell fixture", async () => {
    const html = `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>HotelOS</title>
    <style>${tokens}</style>
  </head>
  <body>
    <a class="hotelos-skip-link" href="#main-content">דלג לתוכן</a>
    <header>
      <p>HotelOS AI</p>
      <nav aria-label="ראשי">
        <a href="#main-content">לוח בקרה</a>
      </nav>
    </header>
    <main id="main-content" tabindex="-1">
      <h1>לוח בקרה</h1>
      <p>תוכן ראשי לבדיקת נגישות.</p>
      <button type="button">פעולה</button>
    </main>
  </body>
</html>`;

    const dom = new JSDOM(html, {
      pretendToBeVisual: true,
      url: "https://hotelos.test/",
      runScripts: "dangerously",
    });
    dom.window.eval(axeSource);
    const axe = (
      dom.window as unknown as {
        axe: {
          run: (
            context?: unknown,
            options?: unknown,
          ) => Promise<{ violations: readonly AxeViolation[] }>;
        };
      }
    ).axe;

    const results = await axe.run(dom.window.document, {
      resultTypes: ["violations"],
    });
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    assert.equal(
      blocking.length,
      0,
      blocking.map((v) => `${v.id}: ${v.help}`).join("; "),
    );
  });
});
