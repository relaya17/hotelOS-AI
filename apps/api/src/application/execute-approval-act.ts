import { randomUUID } from "node:crypto";
import type {
  CandidateStage,
  MaintenanceRepository,
  OpsRepository,
  PersistedApprovalRequest,
  PersistedDepartmentTask,
  PersistedJobCandidate,
  PersistedPurchaseOrder,
  PersistedVendorQuote,
  ProcurementRepository,
  RecruitingRepository,
  TaskPriority,
} from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";

export type ExecuteApprovalActDeps = {
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
  readonly maintenance: MaintenanceRepository;
  readonly recruiting: RecruitingRepository;
};

export type ApprovalActResult =
  | {
      readonly status: "skipped";
      readonly reasonHe: string;
    }
  | {
      readonly status: "executed";
      readonly action:
        | "create_department_task"
        | "create_purchase_order_draft"
        | "send_purchase_order"
        | "accept_maintenance_quote"
        | "create_housekeeping_clean_tasks"
        | "create_reception_arrival_tasks"
        | "update_recruiting_stage";
      readonly resourceType:
        | "department_task"
        | "purchase_order"
        | "vendor_quote"
        | "housekeeping_batch"
        | "reception_arrival_batch"
        | "job_candidate";
      readonly resourceId: string;
      readonly summaryHe: string;
      readonly task?: PersistedDepartmentTask;
      readonly purchaseOrder?: PersistedPurchaseOrder;
      readonly quote?: PersistedVendorQuote;
      readonly candidate?: PersistedJobCandidate;
      readonly taskCount?: number;
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

type AutonomyMaintenanceQuoteAcceptPayload = {
  readonly kind: "autonomy.maintenance_quote_accept";
  readonly hotelId: string;
  readonly quoteId: string;
  readonly maintenanceRequestId: string;
  readonly vendorId: string;
  readonly amount: number;
  readonly currency: string;
  readonly requestTitle?: string;
};

type AutonomyHousekeepingCleanBatchPayload = {
  readonly kind: "autonomy.housekeeping_clean_batch";
  readonly hotelId: string;
  readonly rooms: readonly {
    readonly roomId: string;
    readonly number: string;
    readonly floor: string;
    readonly roomType: string;
  }[];
};

type AutonomyReceptionArrivalPrepBatchPayload = {
  readonly kind: "autonomy.reception_arrival_prep_batch";
  readonly hotelId: string;
  readonly checkInDate: string;
  readonly arrivals: readonly {
    readonly bookingId: string;
    readonly guestName: string;
    readonly roomNumber: string;
    readonly roomId: string;
    readonly checkOutDate: string;
  }[];
};

type AutonomyProcurementSendPayload = {
  readonly kind: "autonomy.procurement_send";
  readonly hotelId: string;
  readonly purchaseOrderId: string;
  readonly vendorId: string;
  readonly totalAmount: number;
  readonly currency: string;
};

type AutonomyRecruitingStagePayload = {
  readonly kind: "autonomy.recruiting_stage";
  readonly hotelId: string;
  readonly candidateId: string;
  readonly jobPostingId: string;
  readonly postingTitle: string;
  readonly candidateName: string;
  readonly fromStage: string;
  readonly stage: "offer" | "hired";
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

function asMaintenanceQuoteAcceptPayload(
  value: unknown,
): AutonomyMaintenanceQuoteAcceptPayload | null {
  if (
    !isRecord(value) ||
    value["kind"] !== "autonomy.maintenance_quote_accept"
  ) {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["quoteId"] !== "string" ||
    typeof value["maintenanceRequestId"] !== "string" ||
    typeof value["vendorId"] !== "string" ||
    typeof value["amount"] !== "number" ||
    typeof value["currency"] !== "string"
  ) {
    return null;
  }
  return {
    kind: "autonomy.maintenance_quote_accept",
    hotelId: value["hotelId"],
    quoteId: value["quoteId"],
    maintenanceRequestId: value["maintenanceRequestId"],
    vendorId: value["vendorId"],
    amount: value["amount"],
    currency: value["currency"],
    ...(typeof value["requestTitle"] === "string"
      ? { requestTitle: value["requestTitle"] }
      : {}),
  };
}

function asHousekeepingCleanBatchPayload(
  value: unknown,
): AutonomyHousekeepingCleanBatchPayload | null {
  if (
    !isRecord(value) ||
    value["kind"] !== "autonomy.housekeeping_clean_batch"
  ) {
    return null;
  }
  if (typeof value["hotelId"] !== "string" || !Array.isArray(value["rooms"])) {
    return null;
  }
  const rooms: AutonomyHousekeepingCleanBatchPayload["rooms"][number][] = [];
  for (const room of value["rooms"]) {
    if (!isRecord(room)) return null;
    if (
      typeof room["roomId"] !== "string" ||
      typeof room["number"] !== "string" ||
      typeof room["floor"] !== "string" ||
      typeof room["roomType"] !== "string"
    ) {
      return null;
    }
    rooms.push({
      roomId: room["roomId"],
      number: room["number"],
      floor: room["floor"],
      roomType: room["roomType"],
    });
  }
  if (rooms.length === 0) return null;
  return {
    kind: "autonomy.housekeeping_clean_batch",
    hotelId: value["hotelId"],
    rooms,
  };
}

function asReceptionArrivalPrepBatchPayload(
  value: unknown,
): AutonomyReceptionArrivalPrepBatchPayload | null {
  if (
    !isRecord(value) ||
    value["kind"] !== "autonomy.reception_arrival_prep_batch"
  ) {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["checkInDate"] !== "string" ||
    !Array.isArray(value["arrivals"])
  ) {
    return null;
  }
  const arrivals: AutonomyReceptionArrivalPrepBatchPayload["arrivals"][number][] =
    [];
  for (const arrival of value["arrivals"]) {
    if (!isRecord(arrival)) return null;
    if (
      typeof arrival["bookingId"] !== "string" ||
      typeof arrival["guestName"] !== "string" ||
      typeof arrival["roomNumber"] !== "string" ||
      typeof arrival["roomId"] !== "string" ||
      typeof arrival["checkOutDate"] !== "string"
    ) {
      return null;
    }
    arrivals.push({
      bookingId: arrival["bookingId"],
      guestName: arrival["guestName"],
      roomNumber: arrival["roomNumber"],
      roomId: arrival["roomId"],
      checkOutDate: arrival["checkOutDate"],
    });
  }
  if (arrivals.length === 0) return null;
  return {
    kind: "autonomy.reception_arrival_prep_batch",
    hotelId: value["hotelId"],
    checkInDate: value["checkInDate"],
    arrivals,
  };
}

function asProcurementSendPayload(
  value: unknown,
): AutonomyProcurementSendPayload | null {
  if (!isRecord(value) || value["kind"] !== "autonomy.procurement_send") {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["purchaseOrderId"] !== "string" ||
    typeof value["vendorId"] !== "string" ||
    typeof value["totalAmount"] !== "number" ||
    typeof value["currency"] !== "string"
  ) {
    return null;
  }
  return {
    kind: "autonomy.procurement_send",
    hotelId: value["hotelId"],
    purchaseOrderId: value["purchaseOrderId"],
    vendorId: value["vendorId"],
    totalAmount: value["totalAmount"],
    currency: value["currency"],
  };
}

function asRecruitingStagePayload(
  value: unknown,
): AutonomyRecruitingStagePayload | null {
  if (!isRecord(value) || value["kind"] !== "autonomy.recruiting_stage") {
    return null;
  }
  if (
    typeof value["hotelId"] !== "string" ||
    typeof value["candidateId"] !== "string" ||
    typeof value["jobPostingId"] !== "string" ||
    typeof value["postingTitle"] !== "string" ||
    typeof value["candidateName"] !== "string" ||
    typeof value["fromStage"] !== "string" ||
    (value["stage"] !== "offer" && value["stage"] !== "hired")
  ) {
    return null;
  }
  return {
    kind: "autonomy.recruiting_stage",
    hotelId: value["hotelId"],
    candidateId: value["candidateId"],
    jobPostingId: value["jobPostingId"],
    postingTitle: value["postingTitle"],
    candidateName: value["candidateName"],
    fromStage: value["fromStage"],
    stage: value["stage"],
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
 * Safe MVP: tasks, draft/send PO status, quote accept — no PMS rates, no real vendor email/pay.
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
        "לא נשלח לספק — השתמשו ב־Suggest שליחת PO לאישור לפני סימון sent.",
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

  const procurementSend = asProcurementSendPayload(payload);
  if (procurementSend) {
    const existing = await deps.procurement.findPurchaseOrderInHotel(
      Ids.tenant(approval.tenantId),
      Ids.hotel(procurementSend.hotelId),
      procurementSend.purchaseOrderId,
    );
    if (!existing) {
      return { status: "failed", reasonHe: "הזמנת רכש לא נמצאה — Act נכשל." };
    }
    if (existing.status !== "draft") {
      return {
        status: "failed",
        reasonHe: `הזמנת רכש במצב ${existing.status} — ניתן לשלוח רק טיוטה.`,
      };
    }

    const order = await deps.procurement.updatePurchaseOrderStatus(
      Ids.tenant(approval.tenantId),
      procurementSend.purchaseOrderId,
      "sent",
    );
    if (!order) {
      return { status: "failed", reasonHe: "עדכון סטטוס PO נכשל." };
    }

    await createTaskForDepartment(deps.ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(procurementSend.hotelId),
      departmentCode: "procurement",
      taskType: "po_sent_followup",
      title: `מעקב אספקה — PO ${order.id.slice(0, 8)}…`,
      description: [
        "הזמנת רכש סומנה כנשלחה אחרי HITL (Suggest→Approve→Act).",
        `סכום: ₪${procurementSend.totalAmount} ${procurementSend.currency}.`,
        `ספק: ${procurementSend.vendorId}`,
        "MVP: אין אימייל/פקס אמיתי לספק ואין תשלום — סטטוס מערכת בלבד.",
        `מזהה PO: ${order.id}`,
        `מזהה אישור: ${approval.id}`,
      ].join("\n"),
      priority:
        procurementSend.totalAmount >= PROCUREMENT_CHAIN_APPROVAL_ILS
          ? "urgent"
          : procurementSend.totalAmount >= PROCUREMENT_HOTEL_APPROVAL_ILS
            ? "high"
            : "medium",
      createdByUserId: decidedByUserId,
      now,
    });

    return {
      status: "executed",
      action: "send_purchase_order",
      resourceType: "purchase_order",
      resourceId: order.id,
      summaryHe: `בוצע Act — PO סומנה כנשלחה (₪${procurementSend.totalAmount}, ללא אימייל אמיתי).`,
      purchaseOrder: order,
    };
  }

  const quoteAccept = asMaintenanceQuoteAcceptPayload(payload);
  if (quoteAccept) {
    const existing = await deps.maintenance.findQuoteById(
      Ids.tenant(approval.tenantId),
      quoteAccept.quoteId,
    );
    if (!existing) {
      return { status: "failed", reasonHe: "הצעת מחיר לא נמצאה — Act נכשל." };
    }
    if (existing.status !== "pending") {
      return {
        status: "failed",
        reasonHe: `הצעת מחיר כבר במצב ${existing.status} — Act נכשל.`,
      };
    }

    const quote = await deps.maintenance.decideQuote(
      quoteAccept.quoteId,
      "accepted",
      decidedByUserId,
      now,
    );
    if (!quote) {
      return { status: "failed", reasonHe: "אישור הצעת מחיר נכשל." };
    }

    const titleHint = quoteAccept.requestTitle ?? "קריאת תחזוקה";
    await createTaskForDepartment(deps.ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(quoteAccept.hotelId),
      departmentCode: "maintenance",
      taskType: "quote_accepted_followup",
      title: `לתאם קבלן — ${titleHint}`,
      description: [
        "הצעת מחיר אושרה אחרי HITL (Suggest→Approve→Act).",
        `סכום: ₪${quoteAccept.amount} ${quoteAccept.currency}.`,
        `מזהה הצעה: ${quote.id}`,
        `מזהה קריאה: ${quoteAccept.maintenanceRequestId}`,
        "אין שליחה אוטומטית לקבלן / תשלום.",
      ].join("\n"),
      priority:
        quoteAccept.amount >= PROCUREMENT_CHAIN_APPROVAL_ILS
          ? "urgent"
          : quoteAccept.amount >= PROCUREMENT_HOTEL_APPROVAL_ILS
            ? "high"
            : "medium",
      createdByUserId: decidedByUserId,
      now,
    });

    return {
      status: "executed",
      action: "accept_maintenance_quote",
      resourceType: "vendor_quote",
      resourceId: quote.id,
      summaryHe: `בוצע Act — הצעת מחיר אושרה (₪${quoteAccept.amount}). הקריאה עברה ל-approved.`,
      quote,
    };
  }

  const cleanBatch = asHousekeepingCleanBatchPayload(payload);
  if (cleanBatch) {
    const createdTasks: PersistedDepartmentTask[] = [];
    for (const room of cleanBatch.rooms) {
      const task = await createTaskForDepartment(deps.ops, {
        tenantId: Ids.tenant(approval.tenantId),
        hotelId: Ids.hotel(cleanBatch.hotelId),
        departmentCode: "housekeeping",
        taskType: "room_clean",
        title: `ניקוי חדר ${room.number}`,
        description: [
          "שיבוץ ניקיון אחרי אישור AI (Suggest→Approve→Act).",
          `קומה ${room.floor} · סוג ${room.roomType}.`,
          `מזהה חדר: ${room.roomId}`,
          "סטטוס החדר נשאר dirty עד סימון ידני אחרי ניקיון בפועל.",
          `מזהה אישור: ${approval.id}`,
        ].join("\n"),
        priority: "high",
        createdByUserId: decidedByUserId,
        now,
      });
      if (task) createdTasks.push(task);
    }
    if (createdTasks.length === 0) {
      return {
        status: "failed",
        reasonHe: "לא נוצרו משימות משק בית — Act נכשל.",
      };
    }
    const first = createdTasks[0]!;
    return {
      status: "executed",
      action: "create_housekeeping_clean_tasks",
      resourceType: "housekeeping_batch",
      resourceId: first.id,
      summaryHe: `בוצע Act — נפתחו ${createdTasks.length} משימות ניקיון במשק בית (חדרים נשארים dirty).`,
      task: first,
      taskCount: createdTasks.length,
    };
  }

  const arrivalBatch = asReceptionArrivalPrepBatchPayload(payload);
  if (arrivalBatch) {
    const createdTasks: PersistedDepartmentTask[] = [];
    for (const arrival of arrivalBatch.arrivals) {
      const task = await createTaskForDepartment(deps.ops, {
        tenantId: Ids.tenant(approval.tenantId),
        hotelId: Ids.hotel(arrivalBatch.hotelId),
        departmentCode: "front_office",
        taskType: "arrival_prep",
        title: `הכנת צ'ק-אין — ${arrival.guestName} · חדר ${arrival.roomNumber}`,
        description: [
          "הכנת הגעה אחרי אישור AI (Suggest→Approve→Act).",
          `תאריך צ'ק-אין: ${arrivalBatch.checkInDate}.`,
          `צ'ק-אאוט מתוכנן: ${arrival.checkOutDate}.`,
          `מזהה הזמנה: ${arrival.bookingId}`,
          `מזהה חדר: ${arrival.roomId}`,
          "אין צ'ק-אין אוטומטי / שינוי תעריף / חיוב — רק משימת הכנה בקבלה.",
          `מזהה אישור: ${approval.id}`,
        ].join("\n"),
        priority: "high",
        createdByUserId: decidedByUserId,
        now,
      });
      if (task) createdTasks.push(task);
    }
    if (createdTasks.length === 0) {
      return {
        status: "failed",
        reasonHe: "לא נוצרו משימות קבלה — Act נכשל.",
      };
    }
    const first = createdTasks[0]!;
    return {
      status: "executed",
      action: "create_reception_arrival_tasks",
      resourceType: "reception_arrival_batch",
      resourceId: first.id,
      summaryHe: `בוצע Act — נפתחו ${createdTasks.length} משימות הכנת הגעה בקבלה (ללא צ'ק-אין אוטומטי).`,
      task: first,
      taskCount: createdTasks.length,
    };
  }

  const recruitingStage = asRecruitingStagePayload(payload);
  if (recruitingStage) {
    const found = await deps.recruiting.findCandidateInHotel(
      Ids.tenant(approval.tenantId),
      Ids.hotel(recruitingStage.hotelId),
      recruitingStage.candidateId,
    );
    if (!found) {
      return { status: "failed", reasonHe: "מועמד לא נמצא — Act נכשל." };
    }
    if (found.posting.status === "closed") {
      return {
        status: "failed",
        reasonHe: "המשרה סגורה — לא ניתן לעדכן שלב מועמד.",
      };
    }

    const stage = recruitingStage.stage as CandidateStage;
    const candidate = await deps.recruiting.updateCandidateStage(
      recruitingStage.candidateId,
      stage,
    );
    if (!candidate) {
      return { status: "failed", reasonHe: "עדכון שלב מועמד נכשל." };
    }

    const stageHe = stage === "hired" ? "התקבל/ה" : "הצעה נשלחה";
    await createTaskForDepartment(deps.ops, {
      tenantId: Ids.tenant(approval.tenantId),
      hotelId: Ids.hotel(recruitingStage.hotelId),
      departmentCode: "hr",
      taskType: stage === "hired" ? "onboarding_followup" : "offer_followup",
      title: `${stageHe} — ${recruitingStage.candidateName}`,
      description: [
        "עודכן אחרי אישור AI (Suggest→Approve→Act).",
        `משרה: ${recruitingStage.postingTitle}`,
        `שלב קודם: ${recruitingStage.fromStage} → ${stage}`,
        "אין יצירת משתמש/חוזה/שכר אוטומטית — מעקב HR ידני.",
        `מזהה מועמד: ${candidate.id}`,
        `מזהה אישור: ${approval.id}`,
      ].join("\n"),
      priority: stage === "hired" ? "high" : "medium",
      createdByUserId: decidedByUserId,
      now,
    });

    return {
      status: "executed",
      action: "update_recruiting_stage",
      resourceType: "job_candidate",
      resourceId: candidate.id,
      summaryHe: `בוצע Act — ${recruitingStage.candidateName} סומן/ה כ«${stageHe}» (+ משימת HR).`,
      candidate,
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
