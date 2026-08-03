import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OUTCOMES, TAGLINES, WORLD_COMPARISON } from "./content.js";

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
