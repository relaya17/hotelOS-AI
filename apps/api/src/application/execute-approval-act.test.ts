import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  OpsRepository,
  PersistedApprovalRequest,
  PersistedDepartmentTask,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { executeApprovalAct } from "./execute-approval-act.js";

describe("executeApprovalAct", () => {
  const created: PersistedDepartmentTask[] = [];
  const ops = {
    ensureStandardDepartments: async () => undefined,
    findDepartmentByCode: async (
      _tenantId: unknown,
      _hotelId: unknown,
      code: string,
    ) =>
      code === "sales_marketing" || code === "housekeeping"
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
      created.push(task);
      return task;
    },
  } as unknown as OpsRepository;

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
    created.length = 0;
    const result = await executeApprovalAct(
      ops,
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
    assert.match(result.task.title, /ADR/);
    assert.equal(created.length, 1);
  });

  it("skips Act when rejected", async () => {
    const result = await executeApprovalAct(
      ops,
      { ...baseApproval, status: "rejected" },
      Ids.user("00000000-0000-4000-8000-000000000099"),
      "2026-07-19T01:00:00.000Z",
    );
    assert.equal(result.status, "skipped");
  });

  it("creates department task for autonomy.department_task", async () => {
    created.length = 0;
    const result = await executeApprovalAct(
      ops,
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
    assert.equal(result.task.taskType, "urgent_clean");
  });
});
