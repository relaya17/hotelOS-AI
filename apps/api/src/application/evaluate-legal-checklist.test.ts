import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersistedLetterDraft } from "@hotelos/database";
import {
  evaluateLegalChecklist,
  missingLegalAcks,
} from "./evaluate-legal-checklist.js";

function draft(
  overrides: Partial<PersistedLetterDraft> &
    Pick<PersistedLetterDraft, "kind" | "body">,
): PersistedLetterDraft {
  return {
    id: "d1",
    tenantId: "t1",
    hotelId: "h1",
    subject: "הזמנת ציוד",
    recipientLabel: "ספק אלפא בע״מ",
    status: "draft",
    createdByUserId: "u1",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

describe("evaluateLegalChecklist", () => {
  it("skips gate for speech", () => {
    const result = evaluateLegalChecklist(
      draft({ kind: "speech", body: "ברוכים הבאים לאירוע." }),
    );
    assert.equal(result.applies, false);
    assert.equal(result.canApproveWithoutAck, true);
  });

  it("blocks purchase_note with placeholders until ack", () => {
    const result = evaluateLegalChecklist(
      draft({
        kind: "purchase_note",
        body: "מלון דמו מזמין מגבות.\n[יש להשלים ידנית]\nסכום ₪500 תנאי תשלום שוטף+30.",
      }),
    );
    assert.equal(result.applies, true);
    assert.ok(result.blockingItemIds.includes("placeholders_resolved"));
    assert.ok(result.blockingItemIds.includes("human_legal_review"));
    const missing = missingLegalAcks(result, ["placeholders_resolved"]);
    assert.ok(missing.includes("human_legal_review"));
    assert.equal(
      missingLegalAcks(result, result.blockingItemIds).length,
      0,
    );
  });

  it("flags binding legal stance", () => {
    const result = evaluateLegalChecklist(
      draft({
        kind: "formal_letter",
        body: "זו עמדה משפטית מחייבת של המלון כלפי הספק.",
      }),
    );
    const item = result.items.find((i) => i.id === "no_binding_legal_stance");
    assert.equal(item?.status, "fail");
  });
});
