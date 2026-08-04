import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actMessage,
  approvalStatusHe,
  formatPayload,
} from "./approvals-copy.js";

describe("approvals-copy", () => {
  it("maps act messages for executed vs failed", () => {
    assert.equal(
      actMessage({
        status: "executed",
        action: "create_task",
        resourceType: "department_task",
        resourceId: "t1",
        summaryHe: "נוצרה משימה",
      }),
      "נוצרה משימה",
    );
    assert.equal(
      actMessage({ status: "failed", reasonHe: "חסר מלון" }),
      "חסר מלון",
    );
  });

  it("maps Hebrew approval statuses", () => {
    assert.equal(approvalStatusHe("approved"), "אושר");
    assert.equal(approvalStatusHe("rejected"), "נדחה");
    assert.equal(approvalStatusHe("pending"), "pending");
  });

  it("formats payloads for preview", () => {
    assert.equal(formatPayload(null), "—");
    assert.equal(formatPayload({ room: "412" }), '{\n  "room": "412"\n}');
  });
});
