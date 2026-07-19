import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  OpsRepository,
  ProcurementRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import {
  PROCUREMENT_CHAIN_APPROVAL_ILS,
  PROCUREMENT_HOTEL_APPROVAL_ILS,
} from "../../application/execute-approval-act.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type AutonomyRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
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

const suggestSchema = z.discriminatedUnion("kind", [
  suggestDepartmentTaskSchema,
  suggestProcurementDraftSchema,
]);

function approvalReasonForTotal(total: number): string {
  if (total >= PROCUREMENT_CHAIN_APPROVAL_ILS) {
    return `סכום משוער ₪${total} ≥ סף רשת (₪${PROCUREMENT_CHAIN_APPROVAL_ILS}) — נדרש אישור הנהלה לפני טיוטת PO.`;
  }
  if (total >= PROCUREMENT_HOTEL_APPROVAL_ILS) {
    return `סכום משוער ₪${total} ≥ סף מנהל מלון (₪${PROCUREMENT_HOTEL_APPROVAL_ILS}) — נדרש אישור לפני טיוטת PO.`;
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

      const total = body.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );
      const summaryHe =
        body.summaryHe ??
        `הצעת טיוטת רכש: ${body.items.length} פריטים · ₪${total}`;
      const reasonHe = body.reasonHe ?? approvalReasonForTotal(total);

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe,
        reasonHe,
        payloadJson: JSON.stringify({
          kind: "autonomy.procurement_draft",
          hotelId: body.hotelId,
          vendorId: body.vendorId,
          currency: body.currency,
          ...(body.notes ? { notes: body.notes } : {}),
          items: body.items,
          estimatedTotal: total,
          executesSend: false,
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
          quantity,
          unitPrice: body.defaultUnitPrice,
        };
      });
      const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe: `השלמת מלאי נמוך: ${items.length} פריטים · ₪${total}`,
        reasonHe: approvalReasonForTotal(total),
        payloadJson: JSON.stringify({
          kind: "autonomy.procurement_draft",
          hotelId: body.hotelId,
          vendorId: body.vendorId,
          currency: body.currency,
          notes: "הצעה אוטומטית ממלאי מתחת ל-par level",
          items,
          estimatedTotal: total,
          executesSend: false,
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

  return routes;
}
