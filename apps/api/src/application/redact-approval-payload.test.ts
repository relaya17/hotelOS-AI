import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAndRedactApprovalPayload,
  redactSensitiveKeys,
} from "./redact-approval-payload.js";

describe("redactSensitiveKeys", () => {
  it("redacts keys matching password|secret|token|apiKey", () => {
    const input = {
      action: "procurement.create_po",
      password: "hunter2",
      apiKey: "sk-live-abc",
      nested: { refreshToken: "rt-123", vendor: "Acme" },
      items: [{ secret: "x", qty: 1 }],
    };
    const result = redactSensitiveKeys(input) as Record<string, unknown>;
    assert.equal(result["password"], "[REDACTED]");
    assert.equal(result["apiKey"], "[REDACTED]");
    assert.deepEqual(result["nested"], {
      refreshToken: "[REDACTED]",
      vendor: "Acme",
    });
    assert.deepEqual(result["items"], [{ secret: "[REDACTED]", qty: 1 }]);
    assert.equal(result["action"], "procurement.create_po");
  });

  it("returns null for invalid JSON payloads", () => {
    assert.equal(parseAndRedactApprovalPayload("not-json"), null);
  });
});
