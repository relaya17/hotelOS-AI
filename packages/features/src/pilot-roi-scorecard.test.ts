import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeMetricDelta,
  parseBaselineNumber,
  SCORECARD_METRICS,
} from "./pilot-roi-scorecard.js";

describe("pilot-roi-scorecard", () => {
  it("defines seven scorecard-aligned metrics", () => {
    assert.equal(SCORECARD_METRICS.length, 7);
    assert.equal(SCORECARD_METRICS[6]?.id, "revenue-suggestion-approval");
  });

  it("computes improvement delta for lower-is-better metrics", () => {
    const delta = computeMetricDelta({
      current: 3,
      baselineRaw: "5",
      direction: "lower",
    });
    assert.ok(delta);
    assert.equal(delta.improved, true);
    assert.equal(delta.absolute, 2);
  });

  it("parses baseline with percent sign", () => {
    assert.equal(parseBaselineNumber("42%"), 42);
  });
});
