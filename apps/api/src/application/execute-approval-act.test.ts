import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  OpsRepository,
  PersistedApprovalRequest,
  PersistedDepartmentTask,
  PersistedPurchaseOrder,
  ProcurementRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { executeApprovalAct } from "./execute-approval-act.js";

describe("executeApprovalAct", () => {
  const createdTasks: PersistedDepartmentTask[] = [];
  const createdOrders: PersistedPurchaseOrder[] = [];

  const ops = {
    ensureStandardDepartments: async () => undefined,
    findDepartmentByCode: async (
      _tenantId: unknown,
      _hotelId: unknown,
      code: string,
    ) =>
      ["sales_marketing", "housekeeping", "procurement"].includes(code)
        ? { id: `dept-${code}`, hotelId: "h1", code, name: code }
        : null,
    createTask: async (input: {
      readonly id: string;
      readonly tenantId: string;
      readonly hotelId: string;
      readonly departmentId: string;
      readonly taskType: string;
      readonly title: string;
      readonly description: string;
      readonly priority: PersistedDepartmentTask["priority"];
      readonly createdAt: string;
    }) => {
      const task: PersistedDepartmentTask = {
        id: input.id,
        tenantId: String(input.tenantId),
        hotelId: String(input.hotelId),
        departmentId: input.departmentId,
        taskType: input.taskType,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "open",
        assignedToUserId: null,
        dueAt: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      };
      createdTasks.push(task);
      return task;
    },
  } as unknown as OpsRepository;

  const procurement = {
    createPurchaseOrder: async (input: {
      readonly id: string;
      readonly hotelId: string;
      readonly vendorId: string;
      readonly currency: string;
      readonly items: readonly {
        readonly quantity: number;
        readonly unitPrice: number;
      }[];
      readonly createdAt: string;
    }) => {
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const order: PersistedPurchaseOrder = {
        id: input.id,
        hotelId: String(input.hotelId),
        vendorId: input.vendorId,
        status: "draft",
        totalAmount,
        currency: input.currency,
        createdAt: input.createdAt,
      };
      createdOrders.push(order);
      return order;
    },
  } as unknown as ProcurementRepository;

  const deps = { ops, procurement };

  const baseApproval: PersistedApprovalRequest = {
    id: "appr-1",
    tenantId: "00000000-0000-4000-8000-000000000001",
    hotelId: "00000000-0000-4000-8000-000000000010",
    agentId: "agent.revenue",
    requestedByUserId: "u1",
    summaryHe: "test",
    reasonHe: "test",
    payloadJson: "{}",
    status: "approved",
    decidedByUserId: "u2",
    decidedAt: "2026-07-19T00:00:00.000Z",
    createdAt: "2026-07-19T00:00:00.000Z",
  };

  it("creates revenue follow-up task for simulator.revenue", async () => {
    createdTasks.length = 0;
    const result = await executeApprovalAct(
      deps,
      {
        ...baseApproval,
        payloadJson: JSON.stringify({
          kind: "simulator.revenue",
          executesChange: false,
          simulation: {
            hotelId: "00000000-0000-4000-8000-000000000010",
            hotelName: "Demo TLV",
            delta: {
              adrPct: 15,
              occupancyPts: -7.2,
              revparPct: 5,
              revenuePct: 5,
            },
            proposed: { adr: 1150, occupancyPct: 55.2, revpar: 634.8 },
          },
        }),
      },
      Ids.user("00000000-0000-4000-8000-000000000099"),
      "2026-07-19T01:00:00.000Z",
    );
    assert.equal(result.status, "executed");
    if (result.status !== "executed") return;
    assert.equal(result.action, "create_department_task");
    assert.match(result.task?.title ?? "", /ADR/);
    assert.equal(createdTasks.length, 1);
  });

  it("skips Act when rejected", async () => {
    const result = await executeApprovalAct(
      deps,
      { ...baseApproval, status: "rejected" },
      Ids.user("00000000-0000-4000-8000-000000000099"),
      "2026-07-19T01:00:00.000Z",
    );
    assert.equal(result.status, "skipped");
  });

  it("creates department task for autonomy.department_task", async () => {
    createdTasks.length = 0;
    const result = await executeApprovalAct(
      deps,
      {
        ...baseApproval,
        agentId: "agent.housekeeping",
        payloadJson: JSON.stringify({
          kind: "autonomy.department_task",
          hotelId: "00000000-0000-4000-8000-000000000010",
          departmentCode: "housekeeping",
          taskType: "urgent_clean",
          title: "ניקוי דחוף 412",
          description: "אורח בדרך — צריך חדר מוכן",
          priority: "urgent",
        }),
      },
      Ids.user("00000000-0000-4000-8000-000000000099"),
      "2026-07-19T01:00:00.000Z",
    );
    assert.equal(result.status, "executed");
    if (result.status !== "executed") return;
    assert.equal(result.task?.taskType, "urgent_clean");
  });

  it("creates draft PO for autonomy.procurement_draft without sending", async () => {
    createdOrders.length = 0;
    createdTasks.length = 0;
    const result = await executeApprovalAct(
      deps,
      {
        ...baseApproval,
        agentId: "agent.procurement",
        payloadJson: JSON.stringify({
          kind: "autonomy.procurement_draft",
          hotelId: "00000000-0000-4000-8000-000000000010",
          vendorId: "00000000-0000-4000-8000-000000000020",
          currency: "ILS",
          items: [
            {
              description: "מגבות",
              quantity: 40,
              unitPrice: 60,
            },
          ],
        }),
      },
      Ids.user("00000000-0000-4000-8000-000000000099"),
      "2026-07-19T01:00:00.000Z",
    );
    assert.equal(result.status, "executed");
    if (result.status !== "executed") return;
    assert.equal(result.action, "create_purchase_order_draft");
    assert.equal(result.purchaseOrder?.status, "draft");
    assert.equal(result.purchaseOrder?.totalAmount, 2400);
    assert.equal(createdOrders.length, 1);
    assert.ok(createdTasks.some((t) => t.departmentId === "dept-procurement"));
  });
});
