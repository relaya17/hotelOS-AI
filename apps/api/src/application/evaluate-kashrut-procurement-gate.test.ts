import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  PersistedApprovalRequest,
  PersistedKashrutAnnotation,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  detectFoodRelatedProcurement,
  evaluateKashrutProcurementGate,
  kashrutGateAllowsApprove,
} from "./evaluate-kashrut-procurement-gate.js";

const approval: PersistedApprovalRequest = {
  id: "appr-food",
  tenantId: "t1",
  hotelId: "h1",
  agentId: "agent.procurement",
  requestedByUserId: "u1",
  summaryHe: "רכש",
  reasonHe: "test",
  payloadJson: JSON.stringify({
    kind: "autonomy.procurement_draft",
    hotelId: "h1",
    vendorId: "v1",
    currency: "ILS",
    items: [{ description: "קפה טחון", quantity: 10, unitPrice: 20 }],
  }),
  status: "pending",
  decidedByUserId: null,
  decidedAt: null,
  createdAt: "2026-07-19T00:00:00.000Z",
};

describe("evaluateKashrutProcurementGate", () => {
  it("detects food-related line items", () => {
    assert.equal(
      detectFoodRelatedProcurement(JSON.parse(approval.payloadJson)),
      true,
    );
  });

  it("skips when kashrut disabled", () => {
    const gate = evaluateKashrutProcurementGate({
      approval,
      kashrutEnabled: false,
      annotations: [],
    });
    assert.equal(gate.applies, false);
    assert.equal(kashrutGateAllowsApprove(gate, {}).ok, true);
  });

  it("requires ack when no annotation on food PO", () => {
    const gate = evaluateKashrutProcurementGate({
      approval,
      kashrutEnabled: true,
      annotations: [],
    });
    assert.equal(gate.applies, true);
    assert.equal(gate.requiresAck, true);
    assert.equal(kashrutGateAllowsApprove(gate, {}).ok, false);
    assert.equal(
      kashrutGateAllowsApprove(gate, { kashrutAcknowledged: true }).ok,
      true,
    );
  });

  it("blocks on kashrut block without override", () => {
    const annotations: PersistedKashrutAnnotation[] = [
      {
        id: "a1",
        tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111"),
        hotelId: Ids.hotel("33333333-3333-4333-8333-333333333333"),
        targetKind: "procurement",
        targetId: approval.id,
        status: "block",
        message: "אין תעודת כשרות לספק",
        createdByUserId: null,
        createdAt: "2026-07-19T00:00:00.000Z",
      },
    ];
    const gate = evaluateKashrutProcurementGate({
      approval,
      kashrutEnabled: true,
      annotations,
    });
    assert.equal(gate.requiresOverrideBlock, true);
    assert.equal(kashrutGateAllowsApprove(gate, {}).ok, false);
    assert.equal(
      kashrutGateAllowsApprove(gate, { kashrutOverrideBlock: true }).ok,
      true,
    );
  });
});
