import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  canAccessHotel,
  canApproveMoneyAmount,
  canDecideOpsHitl,
  canOperateProcurement,
} from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import type { AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { OpsRouteDeps } from "./ops-deps.js";
import { createResolveOpsHotelId, hotelIdSchema, type OpsContext } from "./ops-hotel.js";

import {
  createInventoryItemSchema,
  createPurchaseOrderSchema,
} from "./ops-schemas.js";


export function createOpsProcurementRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Inventory + purchase orders ----

  routes.get("/inventory", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.procurement.listInventory(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/inventory", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Inventory create requires a procurement/management role",
        );
      }
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createInventoryItemSchema.parse(await c.req.json());
      const created = await deps.procurement.createInventoryItem({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        category: body.category,
        name: body.name,
        unit: body.unit,
        currentStock: body.currentStock,
        reorderThreshold: body.reorderThreshold,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "inventory.create",
        resourceType: "inventory_item",
        resourceId: created.id,
        metadata: {
          category: created.category,
          currentStock: created.currentStock,
          reorderThreshold: created.reorderThreshold,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/purchase-orders", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.procurement.listPurchaseOrders(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/purchase-orders", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Creating a purchase order requires a procurement/management role",
        );
      }
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createPurchaseOrderSchema.parse(await c.req.json());
      const created = await deps.procurement.createPurchaseOrder({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        vendorId: body.vendorId,
        currency: body.currency,
        createdByUserId: principal.userId,
        ...(body.notes ? { notes: body.notes } : {}),
        createdAt: new Date().toISOString(),
        items: body.items.map((item) => ({
          id: randomUUID(),
          ...(item.inventoryItemId ? { inventoryItemId: item.inventoryItemId } : {}),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "purchase_order.create",
        resourceType: "purchase_order",
        resourceId: created.id,
        metadata: {
          vendorId: created.vendorId,
          status: created.status,
          totalAmount: created.totalAmount,
          currency: created.currency,
          itemCount: body.items.length,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/purchase-orders/:id/receive", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Receiving a purchase order requires a procurement/management role",
        );
      }
      const orderId = c.req.param("id");
      const existing = await deps.procurement.findPurchaseOrder(
        principal.scope.tenantId,
        orderId,
      );
      if (!existing) {
        return sendError(c, 404, "ORDER_NOT_FOUND", "Purchase order not found");
      }
      if (!canAccessHotel(principal, Ids.hotel(existing.hotelId))) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }
      const updated = await deps.procurement.receivePurchaseOrder(
        principal.scope.tenantId,
        orderId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "ORDER_NOT_FOUND", "Purchase order not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: Ids.hotel(updated.hotelId),
        actorUserId: principal.userId,
        action: "purchase_order.receive",
        resourceType: "purchase_order",
        resourceId: updated.id,
        metadata: {
          status: updated.status,
          vendorId: updated.vendorId,
          totalAmount: updated.totalAmount,
          currency: updated.currency,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
