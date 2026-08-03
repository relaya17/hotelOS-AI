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
    assert.match(tokens, /clip-path:\s*inset\(50%\)/);
    assert.match(tokens, /\.hotelos-app-bar/);
  });

  it("defines a Hebrew-first body stack and product primitives", () => {
    assert.match(tokens, /--font-body:\s*"Assistant"/);
    assert.match(tokens, /--font-display:\s*"Fraunces"/);
    assert.match(tokens, /\.hotelos-surface/);
    assert.match(tokens, /\.hotelos-hint/);
    assert.match(tokens, /\.hotelos-seg/);
    assert.match(tokens, /\.hotelos-page/);
    assert.match(tokens, /\.hotelos-auth-shell/);
    assert.match(tokens, /@keyframes hotelos-enter/);
  });

  it("keeps visible focus styles and reduced-motion support", () => {
    assert.match(tokens, /:focus-visible/);
    assert.match(tokens, /prefers-reduced-motion:\s*reduce/);
    assert.match(tokens, /forced-colors:\s*active/);
  });
});
