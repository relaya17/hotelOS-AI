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

import { buildOpsForecast } from "../../../../application/build-ops-forecast.js";
import { suggestRevenueRates } from "../../../../application/suggest-revenue-rates.js";
import {
  revenueDecideSchema,
  revenueGenerateSchema,
} from "./ops-schemas.js";


export function createOpsRevenueRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Revenue optimization (HITL suggestions — no PMS writeback) ----



  routes.post("/revenue/suggestions/generate", async (c) => {
    try {
      const principal = c.get("principal");
      const body = revenueGenerateSchema.parse(
        await c.req.json().catch(() => ({})),
      );
      const queryHotelId = c.req.query("hotelId");
      const rawHotelId = body.hotelId ?? queryHotelId;
      if (!rawHotelId) {
        return sendError(
          c,
          400,
          "HOTEL_ID_REQUIRED",
          "hotelId query param or body field is required",
        );
      }
      const parsedHotelId = hotelIdSchema.safeParse(rawHotelId);
      if (!parsedHotelId.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
      }
      const hotelId = Ids.hotel(parsedHotelId.data);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }

      const result = await suggestRevenueRates(
        {
          overview: deps.overview,
          bookings: deps.bookings,
          revenueSuggestions: deps.revenueSuggestions,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelId,
          ...(body.horizonDays !== undefined
            ? { horizonDays: body.horizonDays }
            : {}),
        },
      );
      if (!result) {
        return sendError(c, 404, "NO_DATA", "Hotel or overview not found");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "revenue.suggestions.generate",
        resourceType: "revenue_suggestions",
        resourceId: hotelId,
        metadata: {
          count: result.suggestions.length,
          horizonDays: result.horizonDays,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/revenue/suggestions", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const statusRaw = c.req.query("status");
      const statusParsed =
        statusRaw === "suggested" ||
        statusRaw === "approved" ||
        statusRaw === "rejected"
          ? statusRaw
          : undefined;

      const suggestions = await deps.revenueSuggestions.listByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        statusParsed,
      );
      return c.json({ data: suggestions });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/revenue/suggestions/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canDecideOpsHitl(principal)) {
        return sendError(
          c,
          403,
          "FORBIDDEN",
          "Revenue decisions require executive ops approval role",
        );
      }

      const suggestionId = c.req.param("id");
      const body = revenueDecideSchema.parse(await c.req.json());

      const existing = await deps.revenueSuggestions.findById(
        principal.scope.tenantId,
        suggestionId,
      );
      if (!existing) {
        return sendError(c, 404, "NOT_FOUND", "Suggestion not found");
      }
      if (!canAccessHotel(principal, existing.hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }
      if (existing.status !== "suggested") {
        return sendError(
          c,
          409,
          "ALREADY_DECIDED",
          "Suggestion was already decided",
        );
      }

      const updated = await deps.revenueSuggestions.updateStatus(
        principal.scope.tenantId,
        suggestionId,
        body.status,
        principal.userId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "NOT_FOUND", "Suggestion not found");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: `revenue.suggestions.${body.status}`,
        resourceType: "revenue_suggestion",
        resourceId: suggestionId,
        metadata: {
          hotelId: existing.hotelId,
          suggestedDeltaPct: existing.suggestedDeltaPct,
          periodStart: existing.periodStart,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Ops forecast center (7-day deterministic pack) ----

  routes.get("/forecast", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const forecast = await buildOpsForecast(
        {
          overview: deps.overview,
          bookings: deps.bookings,
          maintenance: deps.maintenance,
        },
        { tenantId: principal.scope.tenantId, hotelId: resolved.hotelId },
      );
      if (!forecast) {
        return sendError(c, 404, "NO_DATA", "Hotel or overview not found");
      }
      return c.json({ data: forecast });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
