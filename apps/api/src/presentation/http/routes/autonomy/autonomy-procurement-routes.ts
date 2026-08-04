import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { detectFoodRelatedProcurement } from "../../../../application/evaluate-kashrut-procurement-gate.js";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  approvalReasonForTotal,
  assertAutonomyAccess,
} from "./autonomy-access.js";
import {
  suggestLowStockSchema,
  suggestSendPurchaseOrderSchema,
} from "./autonomy-schemas.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { AutonomyRouteDeps } from "./autonomy-deps.js";

export function createAutonomyProcurementRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();



    /** Suggest reorder for all inventory items below par level. */
    routes.post("/suggest-low-stock", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestLowStockSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, true);
        if (denied) return denied;
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



    /** Suggest marking a draft PO as sent (HITL; no real vendor email/pay). */
    routes.post("/suggest-send-purchase-order", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestSendPurchaseOrderSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, true);
        if (denied) return denied;
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

  return routes;
}
