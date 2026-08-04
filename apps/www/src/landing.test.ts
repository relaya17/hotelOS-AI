import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OUTCOMES, TAGLINES, TRUST_CONTROLS, WORLD_COMPARISON } from "./content.js";

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
