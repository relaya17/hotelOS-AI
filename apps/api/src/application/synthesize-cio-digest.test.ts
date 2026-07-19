import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSuggestedActions } from "./synthesize-cio-digest.js";

describe("extractSuggestedActions", () => {
  it("parses bullets after המלצות להיום", () => {
    const text = [
      "סיכום קצר של היום.",
      "",
      "המלצות להיום:",
      "• לבדוק תחזוקה דחופה",
      "- להשלים מלאי מגבות",
      "לאשר הצעת מחיר ממתינה",
    ].join("\n");
    const actions = extractSuggestedActions(text);
    assert.equal(actions.length, 3);
    assert.equal(actions[0], "לבדוק תחזוקה דחופה");
  });

  it("returns empty when marker missing", () => {
    assert.deepEqual(extractSuggestedActions("רק סיכום בלי המלצות"), []);
  });
});
