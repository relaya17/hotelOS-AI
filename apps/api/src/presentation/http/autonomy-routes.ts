import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  BookingRepository,
  FeedbackRepository,
  MaintenanceRepository,
  OpsRepository,
  ProcurementRepository,
  RecruitingRepository,
  RoomRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import {
  PROCUREMENT_CHAIN_APPROVAL_ILS,
  PROCUREMENT_HOTEL_APPROVAL_ILS,
} from "../../application/execute-approval-act.js";
import { detectFoodRelatedProcurement } from "../../application/evaluate-kashrut-procurement-gate.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type AutonomyRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
  readonly maintenance: MaintenanceRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly recruiting: RecruitingRepository;
  readonly feedback: FeedbackRepository;
  readonly tokens: JwtTokenService;
};

const suggestDepartmentTaskSchema = z.object({
  kind: z.literal("department_task"),
  hotelId: z.string().uuid(),
  departmentCode: z.string().trim().min(2).max(40),
  taskType: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  agentId: z.string().trim().min(3).max(80).default("agent.cio"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

const suggestProcurementDraftSchema = z.object({
  kind: z.literal("procurement_draft"),
  hotelId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().trim().length(3).default("ILS"),
  notes: z.string().trim().max(1000).optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().uuid().optional(),
        description: z.string().trim().min(1).max(200),
        quantity: z.number().int().positive(),
        unitPrice: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(40),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

const suggestLowStockSchema = z.object({
  hotelId: z.string().uuid(),
  vendorId: z.string().uuid(),
  currency: z.string().trim().length(3).default("ILS"),
  /** Default unit price (₪) when item has no quote — MVP placeholder. */
  defaultUnitPrice: z.number().int().min(0).default(25),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
});

const suggestDirtyRoomsSchema = z.object({
  hotelId: z.string().uuid(),
  /** Optional subset; default = all dirty rooms in hotel. */
  roomIds: z.array(z.string().uuid()).max(80).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.housekeeping"),
});

const suggestTodaysArrivalsSchema = z.object({
  hotelId: z.string().uuid(),
  /** YYYY-MM-DD; default = UTC date of request. */
  checkInDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Optional subset; default = all confirmed arrivals on that date. */
  bookingIds: z.array(z.string().uuid()).max(80).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.reception"),
});

const suggestSendPurchaseOrderSchema = z.object({
  hotelId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
  agentId: z.string().trim().min(3).max(80).default("agent.procurement"),
});

const suggestRecruitingStageSchema = z.object({
  hotelId: z.string().uuid(),
  candidateId: z.string().uuid(),
  stage: z.enum(["offer", "hired"]),
  agentId: z.string().trim().min(3).max(80).default("agent.hr"),
});

const suggestFeedbackFollowupSchema = z.object({
  hotelId: z.string().uuid(),
  feedbackId: z.string().uuid(),
  agentId: z.string().trim().min(3).max(80).default("agent.guest"),
});

function departmentForFeedbackCategories(
  categories: readonly string[],
): string {
  const joined = categories.join(" ").toLowerCase();
  if (/ניקיון|clean|housekeep|מגבת|מצע/.test(joined)) return "housekeeping";
  if (/תחזוקה|maintenance|מזגן|חשמל|אינסטל|תיקון/.test(joined)) {
    return "maintenance";
  }
  if (/אוכל|מזון|מסעדה|food|f&b|ארוח/.test(joined)) return "front_office";
  return "front_office";
}

const suggestMaintenanceQuoteAcceptSchema = z.object({
  kind: z.literal("maintenance_quote_accept"),
  hotelId: z.string().uuid(),
  maintenanceRequestId: z.string().uuid(),
  quoteId: z.string().uuid(),
  requestTitle: z.string().trim().min(1).max(200).optional(),
  agentId: z.string().trim().min(3).max(80).default("agent.maintenance"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

const suggestSchema = z.discriminatedUnion("kind", [
  suggestDepartmentTaskSchema,
  suggestProcurementDraftSchema,
  suggestMaintenanceQuoteAcceptSchema,
]);

function approvalReasonForTotal(
  total: number,
  purpose: "po" | "quote" | "send",
): string {
  if (total >= PROCUREMENT_CHAIN_APPROVAL_ILS) {
    if (purpose === "quote") {
      return `סכום הצעה ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני קבלת הצעת מחיר.`;
    }
    if (purpose === "send") {
      return `סכום PO ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני סימון שליחה לספק.`;
    }
    return `סכום משוער ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני טיוטת PO.`;
  }
  if (total >= PROCUREMENT_HOTEL_APPROVAL_ILS) {
    if (purpose === "quote") {
      return `סכום הצעה ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני קבלת הצעת מחיר.`;
    }
    if (purpose === "send") {
      return `סכום PO ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני סימון שליחה לספק.`;
    }
    return `סכום משוער ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני טיוטת PO.`;
  }
  if (purpose === "quote") {
    return `הצעת מחיר תחזוקה בסך ₪${total} — אישור אנושי לפני Accept (ללא שליחה לקבלן).`;
  }
  if (purpose === "send") {
    return `שליחת PO בסך ₪${total} — אישור אנושי לפני סימון sent (ללא אימייל אמיתי ב-MVP).`;
  }
  return `הצעת רכש AI בסך ₪${total} — אישור אנושי לפני יצירת טיוטת PO (לא נשלח לספק).`;
}

/**
 * Autonomy Suggest — creates a pending AI approval (HITL) before Act.
 */
export function createAutonomyRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.post("/suggest", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      if (body.kind === "department_task") {
        await deps.ops.ensureStandardDepartments(
          principal.scope.tenantId,
          hotelId,
          now,
        );
        const department = await deps.ops.findDepartmentByCode(
          principal.scope.tenantId,
          hotelId,
          body.departmentCode,
        );
        if (!department) {
          return sendError(
            c,
            404,
            "DEPARTMENT_NOT_FOUND",
            `Department ${body.departmentCode} not found`,
          );
        }

        const summaryHe =
          body.summaryHe ?? `הצעת משימה: ${body.title} (${body.departmentCode})`;
        const reasonHe =
          body.reasonHe ??
          "הצעת סוכן AI — נדרש אישור אנושי לפני פתיחת משימה במחלקה.";

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe,
          reasonHe,
          payloadJson: JSON.stringify({
            kind: "autonomy.department_task",
            hotelId: body.hotelId,
            departmentCode: body.departmentCode,
            taskType: body.taskType,
            title: body.title,
            description: body.description,
            priority: body.priority,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            kind: body.kind,
            departmentCode: body.departmentCode,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              nextStepHe: "Approve בתיבת אישורי AI → Act ייפתח משימה במחלקה",
            },
          },
          201,
        );
      }

      if (body.kind === "procurement_draft") {
        const total = body.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0,
        );
        const draftPayload = {
          kind: "autonomy.procurement_draft" as const,
          hotelId: body.hotelId,
          vendorId: body.vendorId,
          currency: body.currency,
          ...(body.notes ? { notes: body.notes } : {}),
          items: body.items,
          estimatedTotal: total,
          executesSend: false,
        };
        const foodRelated = detectFoodRelatedProcurement(draftPayload);
        const summaryHe =
          body.summaryHe ??
          `הצעת טיוטת רכש: ${body.items.length} פריטים · ₪${total}`;
        const reasonHe =
          body.reasonHe ??
          [
            approvalReasonForTotal(total, "po"),
            foodRelated
              ? "רכש מזון/F&B — שער Kashrut לפני Approve→Act."
              : null,
          ]
            .filter(Boolean)
            .join(" ");

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe,
          reasonHe,
          payloadJson: JSON.stringify({
            ...draftPayload,
            foodRelated,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            kind: body.kind,
            agentId: body.agentId,
            estimatedTotal: total,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              estimatedTotal: total,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act ייצור טיוטת PO (לא נשלחת לספק)",
            },
          },
          201,
        );
      }

      const quote = await deps.maintenance.findQuoteById(
        principal.scope.tenantId,
        body.quoteId,
      );
      if (!quote) {
        return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
      }
      if (quote.status !== "pending") {
        return sendError(
          c,
          409,
          "QUOTE_NOT_PENDING",
          `Quote is already ${quote.status}`,
        );
      }
      if (quote.maintenanceRequestId !== body.maintenanceRequestId) {
        return sendError(
          c,
          400,
          "QUOTE_REQUEST_MISMATCH",
          "Quote does not belong to the maintenance request",
        );
      }

      const summaryHe =
        body.summaryHe ??
        `אישור הצעת מחיר תחזוקה: ₪${quote.amount} ${quote.currency}`;
      const reasonHe =
        body.reasonHe ?? approvalReasonForTotal(quote.amount, "quote");

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe,
        reasonHe,
        payloadJson: JSON.stringify({
          kind: "autonomy.maintenance_quote_accept",
          hotelId: body.hotelId,
          quoteId: quote.id,
          maintenanceRequestId: body.maintenanceRequestId,
          vendorId: quote.vendorId,
          amount: quote.amount,
          currency: quote.currency,
          ...(body.requestTitle ? { requestTitle: body.requestTitle } : {}),
          executesVendorNotify: false,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          kind: body.kind,
          agentId: body.agentId,
          quoteId: quote.id,
          amount: quote.amount,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            amount: quote.amount,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act יאשר הצעת מחיר (ללא שליחה לקבלן)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest reorder for all inventory items below par level. */
  routes.post("/suggest-low-stock", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestLowStockSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      const inventory = await deps.procurement.listInventory(
        principal.scope.tenantId,
        hotelId,
      );
      const lowStock = inventory.filter((item) => item.belowThreshold);
      if (lowStock.length === 0) {
        return sendError(
          c,
          404,
          "NO_LOW_STOCK",
          "No inventory items below reorder threshold",
        );
      }

      const items = lowStock.map((item) => {
        const target = Math.max(item.reorderThreshold * 2, item.reorderThreshold + 1);
        const quantity = Math.max(1, target - item.currentStock);
        return {
          inventoryItemId: item.id,
          description: `${item.name} (${item.unit})`,
          category: item.category,
          quantity,
          unitPrice: body.defaultUnitPrice,
        };
      });
      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const draftPayload = {
        kind: "autonomy.procurement_draft" as const,
        hotelId: body.hotelId,
        vendorId: body.vendorId,
        currency: body.currency,
        notes: "הצעה אוטומטית ממלאי מתחת ל-par level",
        items,
        estimatedTotal: total,
        executesSend: false,
      };
      const foodRelated = detectFoodRelatedProcurement(draftPayload);

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `השלמת מלאי נמוך: ${items.length} פריטים · ₪${total}`,
        reasonHe: [
          approvalReasonForTotal(total, "po"),
          foodRelated ? "רכש מזון/F&B — שער Kashrut לפני Approve→Act." : null,
        ]
          .filter(Boolean)
          .join(" "),
        payloadJson: JSON.stringify({
          ...draftPayload,
          foodRelated,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_low_stock",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          itemCount: items.length,
          estimatedTotal: total,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            lowStockCount: items.length,
            estimatedTotal: total,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act ייצור טיוטת PO (לא נשלחת לספק)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest housekeeping clean tasks for dirty rooms (HITL before Act). */
  routes.post("/suggest-dirty-rooms", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestDirtyRoomsSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      const belongs = await deps.rooms.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const allRooms = await deps.rooms.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      const idFilter = body.roomIds ? new Set(body.roomIds) : null;
      const dirty = allRooms.filter(
        (room) =>
          room.status === "dirty" &&
          (idFilter === null || idFilter.has(String(room.id))),
      );
      if (dirty.length === 0) {
        return sendError(
          c,
          404,
          "NO_DIRTY_ROOMS",
          "No dirty rooms match the request",
        );
      }

      const roomPayload = dirty.map((room) => ({
        roomId: String(room.id),
        number: room.number,
        floor: room.floor,
        roomType: room.roomType,
      }));
      const numbers = roomPayload.map((r) => r.number).join(", ");

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `שיבוץ ניקיון: ${dirty.length} חדרים (${numbers})`,
        reasonHe:
          "הצעת agent.housekeeping — נדרש אישור מפקח לפני פתיחת משימות ניקיון במחלקה.",
        payloadJson: JSON.stringify({
          kind: "autonomy.housekeeping_clean_batch",
          hotelId: body.hotelId,
          rooms: roomPayload,
          markVacantOnAct: false,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_dirty_rooms",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          roomCount: dirty.length,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            dirtyRoomCount: dirty.length,
            rooms: roomPayload,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act ייפתח משימות ניקיון (חדרים נשארים dirty)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest marking a draft PO as sent (HITL; no real vendor email/pay). */
  routes.post("/suggest-send-purchase-order", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestSendPurchaseOrderSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      const belongs = await deps.rooms.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const order = await deps.procurement.findPurchaseOrderInHotel(
        principal.scope.tenantId,
        hotelId,
        body.purchaseOrderId,
      );
      if (!order) {
        return sendError(
          c,
          404,
          "PURCHASE_ORDER_NOT_FOUND",
          "Purchase order not found",
        );
      }
      if (order.status !== "draft") {
        return sendError(
          c,
          409,
          "PURCHASE_ORDER_NOT_DRAFT",
          `Purchase order is ${order.status}; only draft can be sent`,
        );
      }

      const items = await deps.procurement.listPurchaseOrderItems(order.id);
      const sendPayload = {
        kind: "autonomy.procurement_send" as const,
        hotelId: body.hotelId,
        purchaseOrderId: order.id,
        vendorId: order.vendorId,
        totalAmount: order.totalAmount,
        currency: order.currency,
        notes: order.notes ?? undefined,
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.inventoryItemId
            ? { inventoryItemId: item.inventoryItemId }
            : {}),
        })),
      };
      const foodRelated = detectFoodRelatedProcurement(sendPayload);

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `שליחת PO לספק — ₪${order.totalAmount} ${order.currency}`,
        reasonHe: approvalReasonForTotal(order.totalAmount, "send"),
        payloadJson: JSON.stringify({
          ...sendPayload,
          foodRelated,
          notifyMode: "status_only",
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_send_purchase_order",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          purchaseOrderId: order.id,
          totalAmount: order.totalAmount,
          foodRelated,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            purchaseOrderId: order.id,
            totalAmount: order.totalAmount,
            currency: order.currency,
            foodRelated,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act יסמן PO כ-sent (ללא אימייל/תשלום אמיתי)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest offer/hired stage change (HITL before Act). */
  routes.post("/suggest-recruiting-stage", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestRecruitingStageSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      const found = await deps.recruiting.findCandidateInHotel(
        principal.scope.tenantId,
        hotelId,
        body.candidateId,
      );
      if (!found) {
        return sendError(
          c,
          404,
          "CANDIDATE_NOT_FOUND",
          "Candidate not found",
        );
      }
      if (found.posting.status === "closed") {
        return sendError(
          c,
          409,
          "POSTING_CLOSED",
          "Cannot advance candidates on a closed posting",
        );
      }
      if (found.candidate.stage === body.stage) {
        return sendError(
          c,
          409,
          "STAGE_UNCHANGED",
          `Candidate is already in stage ${body.stage}`,
        );
      }

      const stageHe = body.stage === "hired" ? "התקבל/ה" : "הצעה נשלחה";
      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `${stageHe}: ${found.candidate.fullName} · ${found.posting.title}`,
        reasonHe:
          body.stage === "hired"
            ? "הצעת agent.hr — נדרש אישור מפקח לפני סימון מועמד כהתקבל (ללא יצירת משתמש/חוזה אוטומטי)."
            : "הצעת agent.hr — נדרש אישור מפקח לפני סימון שליחת הצעת עבודה.",
        payloadJson: JSON.stringify({
          kind: "autonomy.recruiting_stage",
          hotelId: body.hotelId,
          candidateId: found.candidate.id,
          jobPostingId: found.posting.id,
          postingTitle: found.posting.title,
          candidateName: found.candidate.fullName,
          fromStage: found.candidate.stage,
          stage: body.stage,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_recruiting_stage",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          candidateId: found.candidate.id,
          stage: body.stage,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            candidateId: found.candidate.id,
            stage: body.stage,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act יעדכן שלב מועמד (+ משימת מעקב HR)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest front-office arrival-prep tasks for confirmed check-ins (HITL before Act). */
  routes.post("/suggest-todays-arrivals", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestTodaysArrivalsSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();
      const checkInDate = body.checkInDate ?? now.slice(0, 10);

      const belongs = await deps.bookings.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const all = await deps.bookings.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      const idFilter = body.bookingIds ? new Set(body.bookingIds) : null;
      const arrivals = all.filter(
        (booking) =>
          booking.status === "confirmed" &&
          booking.checkInDate === checkInDate &&
          (idFilter === null || idFilter.has(String(booking.id))),
      );
      if (arrivals.length === 0) {
        return sendError(
          c,
          404,
          "NO_ARRIVALS",
          "No confirmed arrivals match the request",
        );
      }

      const arrivalPayload = arrivals.map((booking) => ({
        bookingId: String(booking.id),
        guestName: booking.guestName,
        roomNumber: booking.roomNumber,
        roomId: String(booking.roomId),
        checkOutDate: booking.checkOutDate,
      }));
      const roomsLabel = arrivalPayload
        .map((a) => a.roomNumber)
        .join(", ");

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `הכנת הגעות ${checkInDate}: ${arrivals.length} אורחים (חדרים ${roomsLabel})`,
        reasonHe:
          "הצעת agent.reception — נדרש אישור מפקח לפני פתיחת משימות הכנה בקבלה. ללא צ'ק-אין אוטומטי.",
        payloadJson: JSON.stringify({
          kind: "autonomy.reception_arrival_prep_batch",
          hotelId: body.hotelId,
          checkInDate,
          arrivals: arrivalPayload,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_todays_arrivals",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          arrivalCount: arrivals.length,
          checkInDate,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            arrivalCount: arrivals.length,
            checkInDate,
            arrivals: arrivalPayload,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act ייפתח משימות הכנה בקבלה (ללא צ'ק-אין אוטומטי)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Suggest ops follow-up task for a guest feedback item (HITL; reuses department_task Act). */
  routes.post("/suggest-feedback-followup", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestFeedbackFollowupSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      const item = await deps.feedback.findByIdInHotel(
        principal.scope.tenantId,
        hotelId,
        body.feedbackId,
      );
      if (!item) {
        return sendError(c, 404, "FEEDBACK_NOT_FOUND", "Feedback not found");
      }

      const departmentCode = departmentForFeedbackCategories(item.categories);
      const priority =
        item.rating <= 2 ? "urgent" : item.rating <= 3 ? "high" : "medium";
      const categoriesLabel =
        item.categories.length > 0 ? item.categories.join(", ") : "כללי";
      const commentLine = item.comment?.trim()
        ? item.comment.trim()
        : "(ללא הערה)";

      const title = `מעקב משוב אורח — דירוג ${item.rating}/5`;
      const description = [
        "מעקב אחרי משוב אורח (Suggest→Approve→Act).",
        `דירוג: ${item.rating}/5`,
        `קטגוריות: ${categoriesLabel}`,
        `הערה: ${commentLine}`,
        `מקור: ${item.source}`,
        `מזהה משוב: ${item.id}`,
        item.bookingId ? `הזמנה: ${item.bookingId}` : "ללא קישור להזמנה",
        "אין שליחת הודעה אוטומטית לאורח.",
      ].join("\n");

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `${title} · ${departmentCode}`,
        reasonHe:
          item.rating <= 3
            ? "דירוג נמוך — נדרש אישור מפקח לפני פתיחת משימת מעקב במחלקה."
            : "הצעת מעקב למשוב — נדרש אישור מפקח לפני פתיחת משימה.",
        payloadJson: JSON.stringify({
          kind: "autonomy.department_task",
          hotelId: body.hotelId,
          departmentCode,
          taskType: "guest_feedback_followup",
          title,
          description,
          priority,
          feedbackId: item.id,
          rating: item.rating,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest_feedback_followup",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          feedbackId: item.id,
          rating: item.rating,
          departmentCode,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            feedbackId: item.id,
            departmentCode,
            rating: item.rating,
            nextStepHe:
              "Approve בתיבת אישורי AI → Act ייפתח משימת מעקב במחלקה (ללא הודעה לאורח)",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
