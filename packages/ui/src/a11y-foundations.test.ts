import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(join(here, "styles", "tokens.css"), "utf8");

describe("a11y foundations (Vol. 4 / WCAG 2.2)", () => {
  it("defines a 44px minimum touch target token", () => {
    assert.match(tokens, /--touch-min:\s*2\.75rem/);
  });

  it("exposes a keyboard skip-link that appears on focus", () => {
    assert.match(tokens, /\.hotelos-skip-link/);
    assert.match(tokens, /\.hotelos-skip-link:focus/);
  });

  it("keeps visible focus styles and reduced-motion support", () => {
    assert.match(tokens, /:focus-visible/);
    assert.match(tokens, /prefers-reduced-motion:\s*reduce/);
    assert.match(tokens, /forced-colors:\s*active/);
  });
});
