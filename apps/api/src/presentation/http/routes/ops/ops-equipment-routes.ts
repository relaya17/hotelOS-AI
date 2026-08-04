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

import { buildPilotRoiMetrics } from "../../../../application/build-pilot-roi-metrics.js";
import { runPredictiveMaintenanceScan } from "../../../../application/detect-predictive-maintenance.js";
import {
  createEquipmentAssetSchema,
  decidePredictionSchema,
  windowDaysSchema,
} from "./ops-schemas.js";


export function createOpsEquipmentRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Predictive maintenance (equipment assets + rule-based predictions) ----



  routes.get("/equipment/assets", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const assets = await deps.equipment.listAssetsByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: assets });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/equipment/assets", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const body = createEquipmentAssetSchema.parse(await c.req.json());
      const now = new Date().toISOString();
      const asset = await deps.equipment.createAsset({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        code: body.code,
        nameHe: body.nameHe,
        category: body.category,
        locationHe: body.locationHe,
        ...(body.installDate !== undefined ? { installDate: body.installDate } : {}),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "equipment.asset.create",
        resourceType: "equipment_asset",
        resourceId: asset.id,
        metadata: { code: asset.code, category: asset.category },
        createdAt: now,
      });

      return c.json({ data: asset }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/equipment/scan", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const result = await runPredictiveMaintenanceScan(
        {
          equipment: deps.equipment,
          maintenance: deps.maintenance,
          ops: deps.ops,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelId: resolved.hotelId,
          actorUserId: principal.userId,
        },
      );

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "equipment.predictive.scan",
        resourceType: "maintenance_predictions",
        resourceId: resolved.hotelId,
        metadata: {
          predictionCount: result.predictionCount,
          tasksCreated: result.tasksCreated,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/equipment/predictions", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const statusRaw = c.req.query("status");
      const statusParsed =
        statusRaw === "open" ||
        statusRaw === "acknowledged" ||
        statusRaw === "dismissed" ||
        statusRaw === "converted"
          ? statusRaw
          : undefined;

      const predictions = await deps.equipment.listPredictionsByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        statusParsed,
      );
      return c.json({ data: predictions });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/equipment/predictions/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canDecideOpsHitl(principal)) {
        return sendError(
          c,
          403,
          "FORBIDDEN",
          "Predictive maintenance decisions require executive ops approval role",
        );
      }

      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const predictionId = z.string().uuid().parse(c.req.param("id"));
      const body = decidePredictionSchema.parse(await c.req.json());

      const updated = await deps.equipment.decidePrediction(
        principal.scope.tenantId,
        resolved.hotelId,
        predictionId,
        body.status,
      );

      if (!updated) {
        return sendError(
          c,
          404,
          "PREDICTION_NOT_FOUND",
          "Prediction not found or already decided",
        );
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: `equipment.prediction.${body.status}`,
        resourceType: "maintenance_prediction",
        resourceId: predictionId,
        metadata: { riskScore: updated.riskScore, assetId: updated.assetId },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Pilot ROI scorecard (live metrics, no invented baseline) ----


  routes.get("/pilot-roi", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(
        principal.scope.tenantId,
      );
      const rawHotelId = c.req.query("hotelId");
      const windowParsed = windowDaysSchema.safeParse(
        c.req.query("windowDays") ?? "30",
      );
      if (!windowParsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid windowDays");
      }

      let hotelId: HotelId | undefined;
      if (rawHotelId) {
        const parsed = hotelIdSchema.safeParse(rawHotelId);
        if (!parsed.success) {
          return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
        }
        hotelId = Ids.hotel(parsed.data);
        if (!canAccessHotel(principal, hotelId)) {
          return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
        }
        if (!tenantHotels.some((hotel) => hotel.id === hotelId)) {
          return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
        }
      }

      const metrics = await buildPilotRoiMetrics(
        {
          hotels: deps.hotels,
          briefing: deps.briefing,
          ops: deps.ops,
          bookings: deps.bookings,
          upsells: deps.upsells,
          reputation: deps.reputation,
          revenueSuggestions: deps.revenueSuggestions,
        },
        {
          tenantId: principal.scope.tenantId,
          ...(hotelId !== undefined ? { hotelId } : {}),
          windowDays: windowParsed.data,
        },
      );
      if (!metrics) {
        return sendError(c, 404, "NO_DATA", "No hotels or metrics available");
      }
      return c.json({ data: metrics });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
