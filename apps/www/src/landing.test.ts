import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  OUTCOMES,
  PACKAGES,
  TAGLINES,
  TRUST_CONTROLS,
  WORLD_COMPARISON,
} from "./content.js";
import { LIST_PRICES_USD } from "./list-prices.js";
import { NAV_LINKS } from "./nav-links.js";

describe("landing content", () => {
  it("ships seven outcome rows and four taglines", () => {
    assert.equal(OUTCOMES.length, 7);
    assert.equal(TAGLINES.length, 4);
  });

  it("ships five world-comparison categories ending with HotelOS row", () => {
    assert.equal(WORLD_COMPARISON.length, 5);
    assert.equal(WORLD_COMPARISON.at(-1)?.id, "hotelos");
    assert.equal(WORLD_COMPARISON.at(-1)?.isHotelos, true);
    for (const row of WORLD_COMPARISON) {
      assert.ok(row.category.length > 0);
      assert.ok(row.typicalPain.length > 0);
      assert.ok(row.hotelosAnswer.length > 0);
    }
  });
});

describe("nav ↔ sections", () => {
  it("includes previously orphaned anchors in the header", () => {
    const hrefs = new Set(NAV_LINKS.map((link) => link.href));
    for (const href of ["#how-pilot", "#measure", "#excellence", "#faq"]) {
      assert.ok(hrefs.has(href), `missing nav link ${href}`);
    }
  });

  it("uses unique href and non-empty labels", () => {
    const hrefs = NAV_LINKS.map((link) => link.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
    for (const link of NAV_LINKS) {
      assert.match(link.href, /^#[a-z0-9-]+$/);
      assert.ok(link.label.trim().length > 0);
    }
  });
});

describe("list prices", () => {
  it("keeps PACKAGE audiences on the USD list", () => {
    assert.equal(LIST_PRICES_USD.currency, "USD");
    assert.match(PACKAGES[0]?.audience ?? "", /\$5,000/);
    assert.match(PACKAGES[1]?.audience ?? "", /\$1,000/);
    assert.match(PACKAGES[2]?.audience ?? "", /\$75,000/);
  });

  it("JSON-LD Offer matches list-prices.ts", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts/check-www-jsonld.mjs")],
      { encoding: "utf8" },
    );
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "check-www-jsonld failed",
    );
  });
});

describe("trust controls", () => {
  it("lists six real controls with non-empty copy", () => {
    assert.equal(TRUST_CONTROLS.length, 6);
    for (const control of TRUST_CONTROLS) {
      assert.ok(control.title.length > 0);
      assert.ok(control.body.length > 0);
    }
  });

  it("never claims a compliance certification we do not hold", () => {
    const bannedTerms = /soc\s*2|iso\s*27001|iso\s*9001|pci[\s-]?dss\s+certif/i;
    for (const control of TRUST_CONTROLS) {
      assert.doesNotMatch(control.title, bannedTerms);
      assert.doesNotMatch(control.body, bannedTerms);
    }
  });
});
