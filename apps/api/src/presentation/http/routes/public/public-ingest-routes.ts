import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { ingestPmsReservation } from "../../../../application/ingest-pms-reservation.js";
import { ingestSecurityWebhook } from "../../../../application/ingest-security-webhook.js";
import { ingestSentryWebhook } from "../../../../application/ingest-sentry-webhook.js";
import { ingestReputationReview } from "../../../../application/ingest-reputation-review.js";
import { ingestEnergyReading } from "../../../../application/ingest-energy-reading.js";
import { ingestEquipmentSignal } from "../../../../application/ingest-equipment-signal.js";
import { describePaymentPublicStatus } from "../../../../infrastructure/payment-provider.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { PublicRouteDeps } from "./public-deps.js";
import {
  energyIngestAuthorized,
  equipmentIngestAuthorized,
  pmsInboundAuthorized,
  reputationIngestAuthorized,
  securityIngestAuthorized,
  sentryIngestAuthorized,
} from "./public-webhook-auth.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const pmsInboundSchema = z.object({
  hotelId: z.string().uuid(),
  externalReservationId: z.string().trim().min(2).max(120),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(200),
  guestPhone: z.string().trim().min(6).max(40).optional(),
  checkInDate: dateSchema,
  checkOutDate: dateSchema,
  roomType: z.string().trim().min(2).max(40).optional(),
  roomNumber: z.string().trim().min(1).max(20).optional(),
});

const energyIngestSchema = z.object({
  hotelId: z.string().uuid(),
  meterKind: z.enum(["electric", "hvac", "water", "generic"]),
  kwh: z.number().nonnegative().optional().nullable(),
  recordedAt: z.string().datetime(),
  source: z.string().trim().min(1).max(120),
});

export function createPublicIngestRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.get("/payments/status", (c) =>
    c.json({ data: describePaymentPublicStatus(deps.payments) }),
  );

  routes.post("/pms/inbound", async (c) => {
    try {
      if (!pmsInboundAuthorized(c, deps.pmsInboundSecret)) {
        return sendError(c, 401, "UNAUTHORIZED", "Invalid PMS inbound secret");
      }
      const body = pmsInboundSchema.parse(await c.req.json());
      const result = await ingestPmsReservation(
        {
          hotels: deps.hotels,
          rooms: deps.rooms,
          bookings: deps.bookings,
          audit: deps.audit,
          turbo: deps.turbo,
          ops: deps.ops,
          ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
          ...(deps.pms ? { pms: deps.pms } : {}),
        },
        {
          hotelId: body.hotelId,
          externalReservationId: body.externalReservationId,
          guestName: body.guestName,
          guestEmail: body.guestEmail,
          ...(body.guestPhone !== undefined
            ? { guestPhone: body.guestPhone }
            : {}),
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          ...(body.roomType !== undefined ? { roomType: body.roomType } : {}),
          ...(body.roomNumber !== undefined
            ? { roomNumber: body.roomNumber }
            : {}),
        },
      );
      if (!result.ok) {
        const status =
          result.error.code === "HOTEL_NOT_FOUND"
            ? 404
            : result.error.code === "NO_AVAILABILITY"
              ? 409
              : result.error.code === "DUPLICATE"
                ? 409
                : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }
      return c.json({ data: result.value }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /**
   * VMS / AI-CCTV webhook (no JWT). Configure vendor to POST here with
   * Authorization: Bearer $SECURITY_INGEST_SECRET (or X-HotelOS-Security-Secret).
   */
  routes.post("/security/ingest/:provider", async (c) => {
    try {
      if (
        !securityIngestAuthorized(
          c,
          deps.securityIngestSecret,
          deps.isProduction,
        )
      ) {
        return sendError(
          c,
          401,
          "UNAUTHORIZED",
          "Invalid or missing security ingest secret",
        );
      }
      const providerParsed = z
        .enum(["generic", "example_vms", "milestone", "genetec"])
        .safeParse(c.req.param("provider"));
      if (!providerParsed.success) {
        return sendError(
          c,
          400,
          "UNKNOWN_PROVIDER",
          "Supported providers: generic, example_vms, milestone, genetec",
        );
      }
      const result = await ingestSecurityWebhook(
        {
          hotels: deps.hotels,
          ops: deps.ops,
          audit: deps.audit,
        },
        {
          provider: providerParsed.data,
          body: await c.req.json(),
        },
      );
      if (!result.ok) {
        const status = result.code === "HOTEL_NOT_FOUND" ? 404 : 500;
        return sendError(c, status, result.code, result.message);
      }
      return c.json({ data: result }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /**
   * Sentry / GlitchTip issue or alert webhook (no JWT).
   * Configure vendor to POST here with
   * Authorization: Bearer $SENTRY_INGEST_SECRET (or X-HotelOS-Sentry-Secret).
   */
  routes.post("/sentry/ingest", async (c) => {
    try {
      if (
        !sentryIngestAuthorized(
          c,
          deps.sentryIngestSecret,
          deps.isProduction,
        )
      ) {
        return sendError(
          c,
          401,
          "UNAUTHORIZED",
          "Invalid or missing Sentry ingest secret",
        );
      }
      const result = await ingestSentryWebhook(
        {
          hotels: deps.hotels,
          ops: deps.ops,
          audit: deps.audit,
        },
        {
          body: await c.req.json(),
          ...(deps.sentryDefaultHotelId !== undefined
            ? { defaultHotelId: deps.sentryDefaultHotelId }
            : {}),
        },
      );
      if (!result.ok) {
        const status = result.code === "HOTEL_NOT_FOUND" ? 404 : 500;
        return sendError(c, status, result.code, result.message);
      }
      if (result.skipped) {
        return c.json({ data: { skipped: true, reason: result.reason } });
      }
      return c.json({ data: result }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /**
   * OTA / Google reputation review webhook (no JWT).
   * Configure connector to POST here with
   * Authorization: Bearer $REPUTATION_INGEST_SECRET (or X-HotelOS-Reputation-Secret).
   */
  routes.post("/reputation/ingest/:provider", async (c) => {
    try {
      if (
        !reputationIngestAuthorized(
          c,
          deps.reputationIngestSecret,
          deps.isProduction,
        )
      ) {
        return sendError(
          c,
          401,
          "UNAUTHORIZED",
          "Invalid or missing reputation ingest secret",
        );
      }
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
          publicIngest: true,
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

  /**
   * BMS / utility meter webhook (no JWT).
   * Authorization: Bearer $ENERGY_INGEST_SECRET (or X-HotelOS-Energy-Secret).
   */
  routes.post("/energy/ingest", async (c) => {
    try {
      if (
        !energyIngestAuthorized(
          c,
          deps.energyIngestSecret,
          deps.isProduction,
        )
      ) {
        return sendError(
          c,
          401,
          "UNAUTHORIZED",
          "Invalid or missing energy ingest secret",
        );
      }
      if (!deps.energy) {
        return sendError(c, 503, "UNAVAILABLE", "Energy ingest not configured");
      }

      const body = energyIngestSchema.parse(await c.req.json());
      const result = await ingestEnergyReading(
        {
          hotels: deps.hotels,
          energy: deps.energy,
        },
        {
          hotelId: Ids.hotel(body.hotelId),
          meterKind: body.meterKind,
          kwh: body.kwh ?? null,
          recordedAt: body.recordedAt,
          source: body.source,
        },
      );
      if (!result.ok) {
        const status = result.code === "HOTEL_NOT_FOUND" ? 404 : 500;
        return sendError(c, status, result.code, result.message);
      }
      return c.json({ data: result }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /**
   * Equipment sensor webhook stub (no JWT).
   * Authorization: Bearer $EQUIPMENT_INGEST_SECRET (or X-HotelOS-Equipment-Secret).
   */
  routes.post("/equipment/ingest", async (c) => {
    try {
      if (
        !equipmentIngestAuthorized(
          c,
          deps.equipmentIngestSecret,
          deps.isProduction,
        )
      ) {
        return sendError(
          c,
          401,
          "UNAUTHORIZED",
          "Invalid or missing equipment ingest secret",
        );
      }
      if (!deps.equipment) {
        return sendError(
          c,
          503,
          "UNAVAILABLE",
          "Equipment ingest not configured",
        );
      }

      const result = await ingestEquipmentSignal(
        {
          hotels: deps.hotels,
          equipment: deps.equipment,
          audit: deps.audit,
        },
        {
          body: await c.req.json(),
          publicIngest: true,
        },
      );
      if (!result.ok) {
        const status =
          result.code === "HOTEL_NOT_FOUND" || result.code === "ASSET_NOT_FOUND"
            ? 404
            : result.code === "INVALID_PAYLOAD"
              ? 400
              : 500;
        return sendError(c, status, result.code, result.message);
      }
      return c.json({ data: result }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
