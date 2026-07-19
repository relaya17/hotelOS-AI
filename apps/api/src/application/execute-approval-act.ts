import { randomUUID } from "node:crypto";
import type {
  OpsRepository,
  PersistedApprovalRequest,
  PersistedDepartmentTask,
  PersistedPurchaseOrder,
  ProcurementRepository,
  TaskPriority,
} from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";

export type ExecuteApprovalActDeps = {
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
};

export type ApprovalActResult =
  | {
      readonly status: "skipped";
      readonly reasonHe: string;
    }
  | {
      readonly status: "executed";
      readonly action: "create_department_task" | "create_purchase_order_draft";
      readonly resourceType: "department_task" | "purchase_order";
      readonly resourceId: string;
      readonly summaryHe: string;
      readonly task?: PersistedDepartmentTask;
      readonly purchaseOrder?: PersistedPurchaseOrder;
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

type AutonomyProcurementDraftPayload = {
  readonly kind: "autonomy.procurement_draft";
  readonly hotelId: string;
  readonly vendorId: string;
  readonly currency: string;
  readonly notes?: string;
  readonly items: readonly {
    readonly inventoryItemId?: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
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

function asProcurementDraftPayload(
  value: unknown,
): AutonomyProcurementDraftPayload | null {
  if (!isRecord(value) || value["kind"] !== "autonomy.procurement_draft") {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["vendorId"] !== "string" ||
    typeof value["currency"] !== "string" ||
    !Array.isArray(value["items"]) ||
    value["items"].length === 0
  ) {
    return null;
  }
  const items: AutonomyProcurementDraftPayload["items"][number][] = [];
  for (const item of value["items"]) {
    if (!isRecord(item)) return null;
    if (
      typeof item["description"] !== "string" ||
      typeof item["quantity"] !== "number" ||
      typeof item["unitPrice"] !== "number" ||
      item["quantity"] <= 0 ||
      item["unitPrice"] < 0
    ) {
      return null;
    }
    items.push({
      ...(typeof item["inventoryItemId"] === "string"
        ? { inventoryItemId: item["inventoryItemId"] }
        : {}),
      description: item["description"],
      quantity: item["quantity"],
      unitPrice: item["unitPrice"],
    });
  }
  return {
    kind: "autonomy.procurement_draft",
    hotelId: value["hotelId"],
    vendorId: value["vendorId"],
    currency: value["currency"],
    ...(typeof value["notes"] === "string" ? { notes: value["notes"] } : {}),
    items,
  };
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
 * Safe MVP: department tasks + draft PO only (no PMS rates, no send/pay).
 */
export async function executeApprovalAct(
  deps: ExecuteApprovalActDeps,
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
    const task = await createTaskForDepartment(deps.ops, {
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
    const task = await createTaskForDepartment(deps.ops, {
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

  const procurementDraft = asProcurementDraftPayload(payload);
  if (procurementDraft) {
    const total = procurementDraft.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const order = await deps.procurement.createPurchaseOrder({
      id: randomUUID(),
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(procurementDraft.hotelId),
      vendorId: procurementDraft.vendorId,
      currency: procurementDraft.currency,
      createdByUserId: decidedByUserId,
      notes: [
        procurementDraft.notes ?? "טיוטת רכש מאישור AI (Suggest→Approve→Act)",
        `מזהה אישור: ${approval.id}`,
        "סטטוס: draft בלבד — לא נשלח לספק ולא שולם.",
      ].join("\n"),
      createdAt: now,
      items: procurementDraft.items.map((item) => ({
        id: randomUUID(),
        ...(item.inventoryItemId
          ? { inventoryItemId: item.inventoryItemId }
          : {}),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });

    await createTaskForDepartment(deps.ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(procurementDraft.hotelId),
      departmentCode: "procurement",
      taskType: "po_draft_followup",
      title: `לבדוק טיוטת PO ${order.id.slice(0, 8)}…`,
      description: [
        "נוצרה טיוטת הזמנת רכש אחרי אישור AI.",
        `סכום מנייר: ₪${total} ${procurementDraft.currency}.`,
        "לא נשלח לספק — יש לאשר ידנית לפני שליחה.",
        `מזהה PO: ${order.id}`,
      ].join("\n"),
      priority: total >= 5000 ? "urgent" : total >= 2000 ? "high" : "medium",
      createdByUserId: decidedByUserId,
      now,
    });

    return {
      status: "executed",
      action: "create_purchase_order_draft",
      resourceType: "purchase_order",
      resourceId: order.id,
      summaryHe: `בוצע Act — נוצרה טיוטת PO בסך ₪${total} (לא נשלחה).`,
      purchaseOrder: order,
    };
  }

  return {
    status: "skipped",
    reasonHe: "סוג הצעה ללא Act מוגדר עדיין — האישור נשמר ללא ביצוע.",
  };
}

/** Hotel-manager threshold from procurement-agent.md */
export const PROCUREMENT_HOTEL_APPROVAL_ILS = 2000;
/** Chain HQ threshold from procurement-agent.md */
export const PROCUREMENT_CHAIN_APPROVAL_ILS = 5000;
