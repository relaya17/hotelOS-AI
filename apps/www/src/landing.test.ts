import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OUTCOMES, TAGLINES } from "./content.js";

describe("landing content", () => {
  it("ships seven outcome rows and four taglines", () => {
    assert.equal(OUTCOMES.length, 7);
    assert.equal(TAGLINES.length, 4);
  });
});
