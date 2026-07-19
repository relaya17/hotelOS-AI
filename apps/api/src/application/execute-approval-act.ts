import { randomUUID } from "node:crypto";
import type {
  OpsRepository,
  PersistedApprovalRequest,
  PersistedDepartmentTask,
  TaskPriority,
} from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";

export type ApprovalActResult =
  | {
      readonly status: "skipped";
      readonly reasonHe: string;
    }
  | {
      readonly status: "executed";
      readonly action: "create_department_task";
      readonly resourceType: "department_task";
      readonly resourceId: string;
      readonly summaryHe: string;
      readonly task: PersistedDepartmentTask;
    }
  | {
      readonly status: "failed";
      readonly reasonHe: string;
    };

type SimulatorRevenuePayload = {
  readonly kind: "simulator.revenue";
  readonly simulation: {
    readonly hotelId: string;
    readonly hotelName: string;
    readonly delta: {
      readonly adrPct: number;
      readonly occupancyPts: number;
      readonly revparPct: number;
      readonly revenuePct: number;
    };
    readonly proposed: {
      readonly adr: number;
      readonly occupancyPct: number;
      readonly revpar: number;
    };
    readonly executesChange?: false;
  };
};

type AutonomyDepartmentTaskPayload = {
  readonly kind: "autonomy.department_task";
  readonly hotelId: string;
  readonly departmentCode: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePayload(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function asSimulatorPayload(value: unknown): SimulatorRevenuePayload | null {
  if (!isRecord(value) || value["kind"] !== "simulator.revenue") return null;
  const simulation = value["simulation"];
  if (!isRecord(simulation)) return null;
  if (
    typeof simulation["hotelId"] !== "string" ||
    typeof simulation["hotelName"] !== "string"
  ) {
    return null;
  }
  if (!isRecord(simulation["delta"]) || !isRecord(simulation["proposed"])) {
    return null;
  }
  return value as SimulatorRevenuePayload;
}

function asDepartmentTaskPayload(
  value: unknown,
): AutonomyDepartmentTaskPayload | null {
  if (!isRecord(value) || value["kind"] !== "autonomy.department_task") {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["departmentCode"] !== "string" ||
    typeof value["taskType"] !== "string" ||
    typeof value["title"] !== "string" ||
    typeof value["description"] !== "string" ||
    typeof value["priority"] !== "string"
  ) {
    return null;
  }
  return value as AutonomyDepartmentTaskPayload;
}

async function createTaskForDepartment(
  ops: OpsRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly departmentCode: string;
    readonly taskType: string;
    readonly title: string;
    readonly description: string;
    readonly priority: TaskPriority;
    readonly createdByUserId: UserId;
    readonly now: string;
  },
): Promise<PersistedDepartmentTask | null> {
  await ops.ensureStandardDepartments(
    input.tenantId,
    input.hotelId,
    input.now,
  );
  const department = await ops.findDepartmentByCode(
    input.tenantId,
    input.hotelId,
    input.departmentCode,
  );
  if (!department) return null;
  return ops.createTask({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    departmentId: department.id,
    taskType: input.taskType,
    title: input.title,
    description: input.description,
    priority: input.priority,
    createdByUserId: input.createdByUserId,
    createdAt: input.now,
  });
}

/**
 * Autonomy step 4 — Act after human Approve.
 * Safe MVP: creates department follow-up tasks only (no PMS rate / money mutation).
 */
export async function executeApprovalAct(
  ops: OpsRepository,
  approval: PersistedApprovalRequest,
  decidedByUserId: UserId,
  now: string,
): Promise<ApprovalActResult> {
  if (approval.status !== "approved") {
    return {
      status: "skipped",
      reasonHe: "נדחה — לא בוצע Act.",
    };
  }

  const payload = parsePayload(approval.payloadJson);
  if (payload === null) {
    return { status: "failed", reasonHe: "payload לא תקין — Act נכשל." };
  }

  const simulator = asSimulatorPayload(payload);
  if (simulator) {
    const sim = simulator.simulation;
    const task = await createTaskForDepartment(ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(sim.hotelId),
      departmentCode: "sales_marketing",
      taskType: "revenue_proposal_review",
      title: `בדיקת הצעת ADR — ${sim.hotelName}`,
      description: [
        "נוצר אחרי אישור סימולציית הכנסות (Suggest→Approve→Act).",
        "אין שינוי מחיר אוטומטי ב-PMS.",
        `ADR מוצע: ₪${sim.proposed.adr} (${sim.delta.adrPct}%).`,
        `תפוסה מוערכת: ${sim.proposed.occupancyPct}% (${sim.delta.occupancyPts} נק').`,
        `RevPAR מוערך: ₪${sim.proposed.revpar} (${sim.delta.revparPct}%).`,
        `מזהה אישור: ${approval.id}`,
      ].join("\n"),
      priority: Math.abs(sim.delta.adrPct) >= 10 ? "high" : "medium",
      createdByUserId: decidedByUserId,
      now,
    });
    if (!task) {
      return {
        status: "failed",
        reasonHe: "לא נמצאה מחלקת מכירות — Act נכשל.",
      };
    }
    return {
      status: "executed",
      action: "create_department_task",
      resourceType: "department_task",
      resourceId: task.id,
      summaryHe: `נוצרה משימת מעקב הכנסות: ${task.title}`,
      task,
    };
  }

  const departmentTask = asDepartmentTaskPayload(payload);
  if (departmentTask) {
    const task = await createTaskForDepartment(ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(departmentTask.hotelId),
      departmentCode: departmentTask.departmentCode,
      taskType: departmentTask.taskType,
      title: departmentTask.title,
      description: [
        departmentTask.description,
        "",
        `נוצר אחרי אישור AI (${approval.agentId}). מזהה אישור: ${approval.id}`,
      ].join("\n"),
      priority: departmentTask.priority,
      createdByUserId: decidedByUserId,
      now,
    });
    if (!task) {
      return {
        status: "failed",
        reasonHe: `מחלקה ${departmentTask.departmentCode} לא נמצאה — Act נכשל.`,
      };
    }
    return {
      status: "executed",
      action: "create_department_task",
      resourceType: "department_task",
      resourceId: task.id,
      summaryHe: `בוצע Act — נפתחה משימה: ${task.title}`,
      task,
    };
  }

  return {
    status: "skipped",
    reasonHe: "סוג הצעה ללא Act מוגדר עדיין — האישור נשמר ללא ביצוע.",
  };
}
