import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyReputationSentiment,
  extractReputationTopics,
  reputationNeedsFollowUp,
} from "./classify-reputation-sentiment.js";

describe("classifyReputationSentiment", () => {
  it("marks low ratings as negative", () => {
    assert.equal(
      classifyReputationSentiment(2, "The room was okay"),
      "negative",
    );
  });

  it("detects Hebrew negative keywords on neutral rating", () => {
    assert.equal(
      classifyReputationSentiment(3, "חדר מלוכלך ורועש, לא מומלץ"),
      "negative",
    );
  });

  it("marks high ratings without negatives as positive", () => {
    assert.equal(
      classifyReputationSentiment(5, "Excellent stay, highly recommend"),
      "positive",
    );
  });

  it("extracts topic tags from mixed language text", () => {
    const topics = extractReputationTopics("Clean room but noisy at night");
    assert.ok(topics.includes("cleanliness"));
    assert.ok(topics.includes("room"));
    assert.ok(topics.includes("noise"));
  });
});

describe("reputationNeedsFollowUp", () => {
  it("requires follow-up for rating 3 or negative sentiment", () => {
    assert.equal(reputationNeedsFollowUp(3, "neutral"), true);
    assert.equal(reputationNeedsFollowUp(5, "negative"), true);
    assert.equal(reputationNeedsFollowUp(5, "positive"), false);
  });
});
