import { authGet, authPost } from "./core.js";
import type { CioRole } from "./executive.js";

export type AiGatewayStatusDto = {
  readonly primaryProvider: "deterministic" | "openai_compatible";
  readonly entrypoint: string;
};

export type AiGatewayInvokeResultDto = {
  readonly agentId: string;
  readonly provider: "deterministic" | "openai_compatible";
  readonly answerHe: string;
  readonly confidence: "high" | "medium" | "low";
  readonly citations: readonly {
    readonly title: string;
    readonly url?: string;
    readonly source: "internal" | "trusted" | "company";
    readonly snippet?: string;
  }[];
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe?: string;
  readonly latencyMs: number;
  readonly model?: string;
};

export async function fetchAiGatewayStatus(): Promise<AiGatewayStatusDto> {
  const payload = (await authGet("/v1/ai/gateway/status")) as {
    data: AiGatewayStatusDto;
  };
  return payload.data;
}

export async function invokeAiGateway(input: {
  readonly agentId: string;
  readonly message: string;
  readonly hotelId?: string;
  readonly locale?: "he" | "en";
  readonly contextPack?: string;
}): Promise<AiGatewayInvokeResultDto> {
  const payload = (await authPost("/v1/ai/gateway/invoke", input)) as {
    data: AiGatewayInvokeResultDto;
  };
  return payload.data;
}

export type AiApprovalDto = {
  readonly id: string;
  readonly hotelId?: string | null;
  readonly agentId: string;
  readonly summaryHe: string;
  readonly reasonHe: string;
  readonly status: string;
  readonly payload?: unknown;
  readonly decidedByUserId?: string | null;
  readonly decidedAt?: string | null;
  readonly createdAt: string;
};

export type ApprovalActDto =
  | { readonly status: "skipped"; readonly reasonHe: string }
  | { readonly status: "failed"; readonly reasonHe: string }
  | {
      readonly status: "executed";
      readonly action: string;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly summaryHe: string;
    };

export type DecideAiApprovalResult = {
  readonly approval: AiApprovalDto;
  readonly act: ApprovalActDto;
};

export async function listPendingAiApprovals(): Promise<
  readonly AiApprovalDto[]
> {
  const payload = (await authGet("/v1/ai/approvals/pending")) as {
    data: AiApprovalDto[];
  };
  return payload.data;
}

export async function listRecentAiApprovals(
  limit = 20,
): Promise<readonly AiApprovalDto[]> {
  const payload = (await authGet(
    `/v1/ai/approvals/recent?limit=${limit}`,
  )) as { data: AiApprovalDto[] };
  return payload.data;
}

export type KashrutProcurementGateDto = {
  readonly approvalId: string;
  readonly applies: boolean;
  readonly foodRelated: boolean;
  readonly kashrutEnabled: boolean;
  readonly latestStatus: "ok" | "note" | "warn" | "block" | null;
  readonly latestMessageHe: string | null;
  readonly canApprove: boolean;
  readonly requiresAck: boolean;
  readonly requiresOverrideBlock: boolean;
  readonly gateHe: string;
};

export async function fetchApprovalKashrutGate(
  approvalId: string,
): Promise<KashrutProcurementGateDto> {
  const payload = (await authGet(
    `/v1/ai/approvals/${approvalId}/kashrut-gate`,
  )) as { data: KashrutProcurementGateDto };
  return payload.data;
}

export async function decideAiApproval(
  id: string,
  status: "approved" | "rejected",
  options?: {
    readonly kashrutAcknowledged?: boolean;
    readonly kashrutOverrideBlock?: boolean;
  },
): Promise<DecideAiApprovalResult> {
  const payload = (await authPost(`/v1/ai/approvals/${id}/decide`, {
    status,
    ...(options?.kashrutAcknowledged !== undefined
      ? { kashrutAcknowledged: options.kashrutAcknowledged }
      : {}),
    ...(options?.kashrutOverrideBlock !== undefined
      ? { kashrutOverrideBlock: options.kashrutOverrideBlock }
      : {}),
  })) as { data: AiApprovalDto; act: ApprovalActDto };
  return { approval: payload.data, act: payload.act };
}

export async function suggestAutonomyDepartmentTask(input: {
  readonly hotelId: string;
  readonly departmentCode: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly agentId?: string;
  readonly summaryHe?: string;
  readonly reasonHe?: string;
}): Promise<{ readonly approvalId: string }> {
  const payload = (await authPost("/v1/autonomy/suggest", {
    kind: "department_task",
    ...input,
  })) as {
    data: { approval: { id: string } };
  };
  return { approvalId: payload.data.approval.id };
}

/** Map a deterministic/AI briefing action line to a department for HITL Suggest. */
export function routeBriefingActionToDepartment(
  actionHe: string,
  roleHint?: CioRole,
): {
  readonly departmentCode: string;
  readonly agentId: string;
  readonly priority: "medium" | "high" | "urgent";
} {
  const text = actionHe.toLowerCase();
  if (/ניקיון|dirty|housekeep|חדרים ממתינים/.test(text)) {
    return {
      departmentCode: "housekeeping",
      agentId: "agent.housekeeping",
      priority: "high",
    };
  }
  if (/תחזוקה|maintenance|תיקון/.test(text)) {
    return {
      departmentCode: "maintenance",
      agentId: "agent.maintenance",
      priority: "urgent",
    };
  }
  if (/רכש|מלאי|הזמנת רכש|קניין|procurement|stock/.test(text)) {
    return {
      departmentCode: "procurement",
      agentId: "agent.procurement",
      priority: "high",
    };
  }
  if (/תמחור|שיווק|פרסום|קמפיין|תפוסה נמוכה|revenue|adr/.test(text)) {
    return {
      departmentCode: "sales_marketing",
      agentId: "agent.marketing",
      priority: "medium",
    };
  }
  if (/השקע|בורסה|תזרים|תקציב|investment|ledger/.test(text)) {
    return {
      departmentCode: "finance",
      agentId: "agent.cfo",
      priority: "medium",
    };
  }
  if (/משוב|דירוג|אורח|feedback|guest/.test(text)) {
    return {
      departmentCode: "front_office",
      agentId: "agent.guest",
      priority: "high",
    };
  }
  if (roleHint === "housekeeping") {
    return {
      departmentCode: "housekeeping",
      agentId: "agent.housekeeping",
      priority: "medium",
    };
  }
  if (roleHint === "reception" || roleHint === "fb") {
    return {
      departmentCode: "front_office",
      agentId: "agent.reception",
      priority: "medium",
    };
  }
  return {
    departmentCode: "front_office",
    agentId: "agent.cio",
    priority: "medium",
  };
}

/** Suggest a department-task Act from a briefing / CIO recommended action. */
export async function suggestAutonomyBriefingAction(input: {
  readonly hotelId: string;
  readonly actionHe: string;
  readonly roleHint?: CioRole;
  readonly source?: "daily_briefing" | "cio_digest" | "finance_doctor";
}): Promise<{ readonly approvalId: string; readonly departmentCode: string }> {
  const routed = routeBriefingActionToDepartment(
    input.actionHe,
    input.roleHint,
  );
  const source =
    input.source === "cio_digest"
      ? "תדריך CIO"
      : input.source === "finance_doctor"
        ? "יועץ הנהלה (Finance Doctor)"
        : "תדריך יומי";
  const result = await suggestAutonomyDepartmentTask({
    hotelId: input.hotelId,
    departmentCode: routed.departmentCode,
    taskType: "briefing_followup",
    title: input.actionHe.slice(0, 160),
    description: [
      `פעולה מומלצת מ${source} — אחרי אישור AI (Suggest→Approve→Act).`,
      input.actionHe,
      "אין שינוי מחיר / תשלום / שליחה חיצונית אוטומטית.",
    ].join("\n"),
    priority: routed.priority,
    agentId: routed.agentId,
    summaryHe: `מתדריך: ${input.actionHe.slice(0, 200)}`,
    reasonHe: "המלצת תדריך — נדרש אישור מפקח לפני פתיחת משימת מחלקה.",
  });
  return {
    approvalId: result.approvalId,
    departmentCode: routed.departmentCode,
  };
}

export async function suggestAutonomyProcurementDraft(input: {
  readonly hotelId: string;
  readonly vendorId: string;
  readonly currency?: string;
  readonly notes?: string;
  readonly items: readonly {
    readonly inventoryItemId?: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }[];
  readonly agentId?: string;
  readonly summaryHe?: string;
  readonly reasonHe?: string;
}): Promise<{ readonly approvalId: string; readonly estimatedTotal?: number }> {
  const payload = (await authPost("/v1/autonomy/suggest", {
    kind: "procurement_draft",
    ...input,
  })) as {
    data: { approval: { id: string }; estimatedTotal?: number };
  };
  return {
    approvalId: payload.data.approval.id,
    ...(payload.data.estimatedTotal !== undefined
      ? { estimatedTotal: payload.data.estimatedTotal }
      : {}),
  };
}

export async function suggestAutonomyLowStockReorder(input: {
  readonly hotelId: string;
  readonly vendorId: string;
  readonly currency?: string;
  readonly defaultUnitPrice?: number;
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly lowStockCount: number;
  readonly estimatedTotal: number;
}> {
  const payload = (await authPost("/v1/autonomy/suggest-low-stock", input)) as {
    data: {
      approval: { id: string };
      lowStockCount: number;
      estimatedTotal: number;
    };
  };
  return {
    approvalId: payload.data.approval.id,
    lowStockCount: payload.data.lowStockCount,
    estimatedTotal: payload.data.estimatedTotal,
  };
}

export async function suggestAutonomyMaintenanceQuoteAccept(input: {
  readonly hotelId: string;
  readonly maintenanceRequestId: string;
  readonly quoteId: string;
  readonly requestTitle?: string;
  readonly agentId?: string;
  readonly summaryHe?: string;
  readonly reasonHe?: string;
}): Promise<{ readonly approvalId: string; readonly amount?: number }> {
  const payload = (await authPost("/v1/autonomy/suggest", {
    kind: "maintenance_quote_accept",
    ...input,
  })) as {
    data: { approval: { id: string }; amount?: number };
  };
  return {
    approvalId: payload.data.approval.id,
    ...(payload.data.amount !== undefined
      ? { amount: payload.data.amount }
      : {}),
  };
}

export async function suggestAutonomyDirtyRooms(input: {
  readonly hotelId: string;
  readonly roomIds?: readonly string[];
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly dirtyRoomCount: number;
  readonly rooms: readonly {
    readonly roomId: string;
    readonly number: string;
    readonly floor: string;
    readonly roomType: string;
  }[];
}> {
  const payload = (await authPost("/v1/autonomy/suggest-dirty-rooms", input)) as {
    data: {
      approval: { id: string };
      dirtyRoomCount: number;
      rooms: readonly {
        readonly roomId: string;
        readonly number: string;
        readonly floor: string;
        readonly roomType: string;
      }[];
    };
  };
  return {
    approvalId: payload.data.approval.id,
    dirtyRoomCount: payload.data.dirtyRoomCount,
    rooms: payload.data.rooms,
  };
}

export async function suggestAutonomyTodaysArrivals(input: {
  readonly hotelId: string;
  readonly checkInDate?: string;
  readonly bookingIds?: readonly string[];
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly arrivalCount: number;
  readonly checkInDate: string;
  readonly arrivals: readonly {
    readonly bookingId: string;
    readonly guestName: string;
    readonly roomNumber: string;
    readonly roomId: string;
    readonly checkOutDate: string;
  }[];
}> {
  const payload = (await authPost(
    "/v1/autonomy/suggest-todays-arrivals",
    input,
  )) as {
    data: {
      approval: { id: string };
      arrivalCount: number;
      checkInDate: string;
      arrivals: readonly {
        readonly bookingId: string;
        readonly guestName: string;
        readonly roomNumber: string;
        readonly roomId: string;
        readonly checkOutDate: string;
      }[];
    };
  };
  return {
    approvalId: payload.data.approval.id,
    arrivalCount: payload.data.arrivalCount,
    checkInDate: payload.data.checkInDate,
    arrivals: payload.data.arrivals,
  };
}

export async function suggestAutonomySendPurchaseOrder(input: {
  readonly hotelId: string;
  readonly purchaseOrderId: string;
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly purchaseOrderId: string;
  readonly totalAmount: number;
  readonly currency: string;
  readonly foodRelated: boolean;
}> {
  const payload = (await authPost(
    "/v1/autonomy/suggest-send-purchase-order",
    input,
  )) as {
    data: {
      approval: { id: string };
      purchaseOrderId: string;
      totalAmount: number;
      currency: string;
      foodRelated: boolean;
    };
  };
  return {
    approvalId: payload.data.approval.id,
    purchaseOrderId: payload.data.purchaseOrderId,
    totalAmount: payload.data.totalAmount,
    currency: payload.data.currency,
    foodRelated: payload.data.foodRelated,
  };
}

/**
 * Suggest closing a fiscal month's ledger (stage ז׳ HITL). Approve requires
 * an accountant/CFO role — admin alone is not enough (see `canApproveLedgerClose`).
 */
export async function suggestAutonomyLedgerClose(input: {
  readonly hotelId: string;
  /** YYYY-MM */
  readonly periodKey: string;
  readonly agentId?: string;
}): Promise<{
  readonly approvalId: string;
  readonly periodKey: string;
  readonly periodStatus: string;
}> {
  const payload = (await authPost(
    "/v1/autonomy/suggest-ledger-close",
    input,
  )) as {
    data: {
      approval: { id: string };
      period: { periodKey: string; status: string };
    };
  };
  return {
    approvalId: payload.data.approval.id,
    periodKey: payload.data.period.periodKey,
    periodStatus: payload.data.period.status,
  };
}
