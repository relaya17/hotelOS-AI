import assert from "node:assert/strict";
import { test } from "node:test";
import {
  estimateApprovalAmountIls,
  isMoneyApprovalPayload,
} from "./approval-money-amount.js";

test("estimates amount from items and totalAmount", () => {
  assert.equal(
    estimateApprovalAmountIls(
      JSON.stringify({
        kind: "autonomy.procurement_draft",
        items: [
          { quantity: 2, unitPrice: 100 },
          { quantity: 1, unitPrice: 50 },
        ],
      }),
    ),
    250,
  );
  assert.equal(
    estimateApprovalAmountIls(
      JSON.stringify({ kind: "autonomy.procurement_send", totalAmount: 4200 }),
    ),
    4200,
  );
});

test("detects money payload kinds", () => {
  assert.equal(
    isMoneyApprovalPayload(
      JSON.stringify({ kind: "autonomy.procurement_draft" }),
    ),
    true,
  );
  assert.equal(
    isMoneyApprovalPayload(
      JSON.stringify({ kind: "autonomy.department_task" }),
    ),
    false,
  );
});
