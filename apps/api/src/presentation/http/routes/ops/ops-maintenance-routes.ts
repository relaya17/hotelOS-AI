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
  PROCUREMENT_CHAIN_APPROVAL_ILS,
  PROCUREMENT_HOTEL_APPROVAL_ILS,
} from "../../../../application/execute-approval-act.js";
import {
  createMaintenanceRequestSchema,
  createQuoteSchema,
  createVendorSchema,
  decideQuoteSchema,
  updateMaintenanceStatusSchema,
} from "./ops-schemas.js";


export function createOpsMaintenanceRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Maintenance & procurement (department: maintenance) ----

  routes.get("/maintenance-requests", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.maintenance.listByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/maintenance-requests", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createMaintenanceRequestSchema.parse(await c.req.json());
      const created = await deps.maintenance.createRequest({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        category: body.category,
        title: body.title,
        description: body.description,
        priority: body.priority,
        createdByUserId: principal.userId,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/maintenance-requests/:id", async (c) => {
    try {
      const principal = c.get("principal");
      const requestId = c.req.param("id");
      const body = updateMaintenanceStatusSchema.parse(await c.req.json());
      const updated = await deps.maintenance.updateStatus(
        principal.scope.tenantId,
        requestId,
        body.status,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "REQUEST_NOT_FOUND", "Maintenance request not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: Ids.hotel(updated.hotelId),
        actorUserId: principal.userId,
        action: "maintenance.status.update",
        resourceType: "maintenance_request",
        resourceId: updated.id,
        metadata: {
          status: updated.status,
          category: updated.category,
          priority: updated.priority,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/vendors", async (c) => {
    try {
      const principal = c.get("principal");
      const list = await deps.maintenance.listVendors(principal.scope.tenantId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/vendors", async (c) => {
    try {
      const principal = c.get("principal");
      const body = createVendorSchema.parse(await c.req.json());
      const created = await deps.maintenance.createVendor({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        name: body.name,
        category: body.category,
        ...(body.contactName ? { contactName: body.contactName } : {}),
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/maintenance-requests/:id/quotes", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Quote create requires a procurement/management role",
        );
      }
      const requestId = c.req.param("id");
      const request = await deps.maintenance.findRequestById(
        principal.scope.tenantId,
        requestId,
      );
      if (!request) {
        return sendError(c, 404, "REQUEST_NOT_FOUND", "Maintenance request not found");
      }
      if (!canAccessHotel(principal, Ids.hotel(request.hotelId))) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }
      const body = createQuoteSchema.parse(await c.req.json());
      const created = await deps.maintenance.addQuote({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        maintenanceRequestId: requestId,
        vendorId: body.vendorId,
        amount: body.amount,
        currency: body.currency,
        ...(body.validUntil ? { validUntil: body.validUntil } : {}),
        submittedAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/maintenance-requests/:id/quotes", async (c) => {
    try {
      const principal = c.get("principal");
      const requestId = c.req.param("id");
      const request = await deps.maintenance.findRequestById(
        principal.scope.tenantId,
        requestId,
      );
      if (!request) {
        return sendError(c, 404, "REQUEST_NOT_FOUND", "Maintenance request not found");
      }
      if (!canAccessHotel(principal, Ids.hotel(request.hotelId))) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }
      const list = await deps.maintenance.listQuotesForRequest(
        principal.scope.tenantId,
        requestId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/quotes/:id/decision", async (c) => {
    try {
      const principal = c.get("principal");
      const quoteId = c.req.param("id");
      const body = decideQuoteSchema.parse(await c.req.json());
      const quote = await deps.maintenance.findQuoteById(
        principal.scope.tenantId,
        quoteId,
      );
      if (!quote) {
        return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
      }
      if (quote.maintenanceRequestId) {
        const request = await deps.maintenance.findRequestById(
          principal.scope.tenantId,
          quote.maintenanceRequestId,
        );
        if (!request) {
          return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
        }
        if (!canAccessHotel(principal, Ids.hotel(request.hotelId))) {
          return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
        }
      }
      if (
        body.status === "accepted" &&
        !canApproveMoneyAmount(principal, quote.amount, {
          hotelIls: PROCUREMENT_HOTEL_APPROVAL_ILS,
          chainIls: PROCUREMENT_CHAIN_APPROVAL_ILS,
        })
      ) {
        return sendError(
          c,
          403,
          "MONEY_ROLE_REQUIRED",
          "Accepting a quote requires a money-approver role for this amount",
        );
      }
      if (body.status === "rejected" && !canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Rejecting a quote requires a procurement/management role",
        );
      }
      const updated = await deps.maintenance.decideQuote(
        principal.scope.tenantId,
        quoteId,
        body.status,
        principal.userId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "QUOTE_NOT_FOUND", "Quote not found");
      }
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
