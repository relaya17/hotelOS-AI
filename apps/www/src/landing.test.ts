import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OUTCOMES, TAGLINES } from "./content.js";

describe("landing content", () => {
  it("ships six outcome rows and three taglines", () => {
    assert.equal(OUTCOMES.length, 6);
    assert.equal(TAGLINES.length, 3);
  });
});
