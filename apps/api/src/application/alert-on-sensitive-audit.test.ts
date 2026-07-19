import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AuditWrite } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { isSensitiveAuditEvent } from "./alert-on-sensitive-audit.js";

function baseEvent(overrides: Partial<AuditWrite> = {}): AuditWrite {
  return {
    id: "a1",
    tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111"),
    action: "autonomy.act",
    resourceType: "approval",
    metadata: {},
    createdAt: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}

describe("isSensitiveAuditEvent", () => {
  it("flags autonomy act and payment intents", () => {
    assert.equal(isSensitiveAuditEvent(baseEvent()), true);
    assert.equal(
      isSensitiveAuditEvent(baseEvent({ action: "payment.intent.created" })),
      true,
    );
  });

  it("requires sensitiveHr for HR document reviews", () => {
    assert.equal(
      isSensitiveAuditEvent(
        baseEvent({
          action: "hr.document.approved",
          metadata: { sensitiveHr: true },
        }),
      ),
      true,
    );
    assert.equal(
      isSensitiveAuditEvent(
        baseEvent({
          action: "hr.document.approved",
          metadata: {},
        }),
      ),
      false,
    );
  });

  it("ignores noise and non-sensitive actions", () => {
    assert.equal(
      isSensitiveAuditEvent(baseEvent({ action: "ops.error_event.create" })),
      false,
    );
    assert.equal(
      isSensitiveAuditEvent(baseEvent({ action: "auth.login" })),
      false,
    );
  });
});
