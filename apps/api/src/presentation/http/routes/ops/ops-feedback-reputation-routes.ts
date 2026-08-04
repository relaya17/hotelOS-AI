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

import { ingestReputationReview } from "../../../../application/ingest-reputation-review.js";


export function createOpsFeedbackReputationRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Guest feedback (internal view; submission is public, see public-routes.ts) ----

  routes.get("/feedback", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.feedback.listByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      const average = await deps.feedback.averageRating(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: { average, items: list } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Reputation reviews (OTA / Google ingest) ----

  routes.get("/reputation/reviews", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const sentimentParsed = z
        .enum(["positive", "neutral", "negative"])
        .safeParse(c.req.query("sentiment"));
      const limitParsed = z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .safeParse(c.req.query("limit") ?? "20");
      const list = await deps.reputation.listRecent(
        principal.scope.tenantId,
        resolved.hotelId,
        {
          limit: limitParsed.success ? limitParsed.data : 20,
          ...(sentimentParsed.success
            ? { sentiment: sentimentParsed.data }
            : {}),
        },
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/reputation/ingest/:provider", async (c) => {
    try {
      const principal = c.get("principal");
      const providerParsed = z
        .enum(["generic", "google", "booking", "tripadvisor"])
        .safeParse(c.req.param("provider"));
      if (!providerParsed.success) {
        return sendError(
          c,
          400,
          "UNKNOWN_PROVIDER",
          "Supported providers: generic, google, booking, tripadvisor",
        );
      }
      const result = await ingestReputationReview(
        {
          hotels: deps.hotels,
          ops: deps.ops,
          reputation: deps.reputation,
          audit: deps.audit,
        },
        {
          provider: providerParsed.data,
          body: await c.req.json(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
        },
      );
      if (!result.ok) {
        const status = result.code === "HOTEL_NOT_FOUND" ? 404 : 500;
        return sendError(c, status, result.code, result.message);
      }
      return c.json({ data: result }, result.duplicate ? 200 : 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
