import assert from "node:assert/strict";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import {
  canApproveMoneyAmount,
  canDecideOpsHitl,
  canOperateProcurement,
} from "./money-rbac.js";
import type { AuthPrincipal } from "./tenancy.js";

const thresholds = { hotelIls: 2000, chainIls: 5000 };

function principal(roles: readonly string[]): AuthPrincipal {
  return {
    userId: Ids.user("11111111-1111-4111-8111-111111111111"),
    roles,
    scope: {
      tenantId: Ids.tenant("22222222-2222-4222-8222-222222222222"),
    },
  };
}

test("reception cannot operate procurement", () => {
  assert.equal(canOperateProcurement(principal(["reception"])), false);
  assert.equal(canOperateProcurement(principal(["admin"])), true);
});

test("money approval roles scale with amount", () => {
  const gm = principal(["gm"]);
  const reception = principal(["reception"]);
  const cfo = principal(["cfo"]);

  assert.equal(canApproveMoneyAmount(gm, 500, thresholds), true);
  assert.equal(canApproveMoneyAmount(reception, 500, thresholds), false);
  assert.equal(canApproveMoneyAmount(gm, 2500, thresholds), true);
  assert.equal(canApproveMoneyAmount(gm, 6000, thresholds), false);
  assert.equal(canApproveMoneyAmount(cfo, 6000, thresholds), true);
});

test("ops HITL allows reception and housekeeping", () => {
  assert.equal(canDecideOpsHitl(principal(["reception"])), true);
  assert.equal(canDecideOpsHitl(principal(["housekeeping"])), true);
  assert.equal(canDecideOpsHitl(principal(["employee"])), false);
});
