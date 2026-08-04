import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { buildGuestFolio } from "../../../../application/build-guest-folio.js";
import {
  decideUpsellOffer,
  toPublicUpsellDto,
} from "../../../../application/suggest-guest-upsells.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { PublicRouteDeps } from "./public-deps.js";

const SERVICE_TYPE_META = {
  towels: {
    title: "מגבות נוספות",
    departmentCode: "housekeeping",
    taskType: "guest_towels",
  },
  cleaning: {
    title: "ניקיון חדר",
    departmentCode: "housekeeping",
    taskType: "guest_cleaning",
  },
  amenities: {
    title: "שירותי חדר",
    departmentCode: "housekeeping",
    taskType: "guest_amenities",
  },
} as const;

const lookupSchema = z.object({
  email: z.string().email().max(200),
});

const feedbackSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  categories: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  comment: z.string().trim().max(2000).optional(),
});

const checkInSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
});

const checkOutSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
});

const folioSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
});

const guestUpsellDecideSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
  decision: z.enum(["accepted", "declined"]),
});

const serviceRequestSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
  serviceType: z.enum(["towels", "cleaning", "amenities"]),
  note: z.string().trim().max(1000).optional(),
});

export function createPublicStaysRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/stays/lookup", async (c) => {
    try {
      const body = lookupSchema.parse(await c.req.json());
      const stays = await deps.guestStays.lookupByEmail(body.email);
      const normalizedEmail = body.email.trim().toLowerCase();
      const data = await Promise.all(
        stays.map(async (stay) => {
          const offers = await deps.upsells.listSuggestedForGuest(
            Ids.booking(stay.bookingId),
            normalizedEmail,
          );
          return {
            bookingId: stay.bookingId,
            hotelId: stay.hotelId,
            hotelName: stay.hotelName,
            roomNumber: stay.roomNumber,
            guestName: stay.guestName,
            guestPhone: stay.guestPhone,
            checkInDate: stay.checkInDate,
            checkOutDate: stay.checkOutDate,
            status: stay.status,
            roomPrepStatus: stay.roomPrepStatus,
            roomStatus: stay.roomStatus,
            upsellOffers: offers.map(toPublicUpsellDto),
          };
        }),
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/stays/folio", async (c) => {
    try {
      const body = folioSchema.parse(await c.req.json());
      const stayResult = await deps.guestStays.findActiveFolioStayForEmail(
        body.email,
        body.bookingId,
      );
      if (!stayResult.ok) {
        if (stayResult.reason === "BOOKING_NOT_FOUND") {
          return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
        }
        if (stayResult.reason === "EMAIL_MISMATCH") {
          return sendError(
            c,
            403,
            "EMAIL_MISMATCH",
            "Booking does not belong to this email",
          );
        }
        return sendError(c, 409, "STAY_NOT_ACTIVE", "Stay is not active");
      }

      return c.json({ data: buildGuestFolio(stayResult.stay) });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/stays/upsells/:id/decide", async (c) => {
    try {
      const offerId = z.string().uuid().parse(c.req.param("id"));
      const body = guestUpsellDecideSchema.parse(await c.req.json());
      const stayResult = await deps.guestStays.findActiveStayForEmail(
        body.email,
        body.bookingId,
      );
      if (!stayResult.ok) {
        if (stayResult.reason === "BOOKING_NOT_FOUND") {
          return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
        }
        if (stayResult.reason === "EMAIL_MISMATCH") {
          return sendError(
            c,
            403,
            "EMAIL_MISMATCH",
            "Booking does not belong to this email",
          );
        }
        return sendError(c, 409, "STAY_NOT_ACTIVE", "Stay is not active");
      }

      const result = await decideUpsellOffer(deps.upsells, {
        tenantId: Ids.tenant(stayResult.tenantId),
        hotelId: Ids.hotel(stayResult.stay.hotelId),
        offerId,
        decision: body.decision,
      });

      if (!result.ok) {
        const status =
          result.error.code === "OFFER_NOT_FOUND"
            ? 404
            : result.error.code === "OFFER_ALREADY_DECIDED"
              ? 409
              : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }

      if (result.offer.bookingId !== body.bookingId) {
        return sendError(c, 404, "OFFER_NOT_FOUND", "Offer not found for stay");
      }

      return c.json({ data: toPublicUpsellDto(result.offer) });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/stays/check-in", async (c) => {
    try {
      const body = checkInSchema.parse(await c.req.json());
      const result = await deps.guestStays.checkInByEmail(
        body.email,
        body.bookingId,
      );

      if (!result.ok) {
        if (result.reason === "BOOKING_NOT_FOUND") {
          return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
        }
        if (result.reason === "EMAIL_MISMATCH") {
          return sendError(
            c,
            403,
            "EMAIL_MISMATCH",
            "Booking does not belong to this email",
          );
        }
        return sendError(
          c,
          409,
          "NOT_CONFIRMED",
          "Only confirmed bookings can be checked in",
        );
      }

      return c.json({
        data: {
          bookingId: result.stay.bookingId,
          hotelId: result.stay.hotelId,
          hotelName: result.stay.hotelName,
          roomNumber: result.stay.roomNumber,
          guestName: result.stay.guestName,
          guestPhone: result.stay.guestPhone,
          checkInDate: result.stay.checkInDate,
          checkOutDate: result.stay.checkOutDate,
          status: result.stay.status,
          roomPrepStatus: result.stay.roomPrepStatus,
          roomStatus: result.stay.roomStatus,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/stays/check-out", async (c) => {
    try {
      const body = checkOutSchema.parse(await c.req.json());
      const result = await deps.guestStays.checkOutByEmail(
        body.email,
        body.bookingId,
      );

      if (!result.ok) {
        if (result.reason === "BOOKING_NOT_FOUND") {
          return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
        }
        if (result.reason === "EMAIL_MISMATCH") {
          return sendError(
            c,
            403,
            "EMAIL_MISMATCH",
            "Booking does not belong to this email",
          );
        }
        return sendError(
          c,
          409,
          "NOT_CHECKED_IN",
          "Only checked-in stays can be checked out",
        );
      }

      if (deps.guestProfiles) {
        try {
          const scope = await deps.guestStays.findBookingScope(body.bookingId);
          if (scope) {
            await deps.guestProfiles.rememberStay({
              id: randomUUID(),
              tenantId: Ids.tenant(scope.tenantId),
              email: body.email,
              displayName: result.stay.guestName,
              phone: result.stay.guestPhone,
              hotelId: Ids.hotel(result.stay.hotelId),
              stayAt: new Date().toISOString(),
              noteHe: "checkout",
            });
          }
        } catch {
          // Best-effort guest memory.
        }
      }

      return c.json({
        data: {
          bookingId: result.stay.bookingId,
          hotelId: result.stay.hotelId,
          hotelName: result.stay.hotelName,
          roomNumber: result.stay.roomNumber,
          guestName: result.stay.guestName,
          guestPhone: result.stay.guestPhone,
          checkInDate: result.stay.checkInDate,
          checkOutDate: result.stay.checkOutDate,
          status: result.stay.status,
          roomPrepStatus: result.stay.roomPrepStatus,
          roomStatus: result.stay.roomStatus,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/stays/service-request", async (c) => {
    try {
      const body = serviceRequestSchema.parse(await c.req.json());
      const stayResult = await deps.guestStays.findActiveStayForEmail(
        body.email,
        body.bookingId,
      );
      if (!stayResult.ok) {
        if (stayResult.reason === "BOOKING_NOT_FOUND") {
          return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
        }
        if (stayResult.reason === "EMAIL_MISMATCH") {
          return sendError(
            c,
            403,
            "EMAIL_MISMATCH",
            "Booking does not belong to this email",
          );
        }
        return sendError(c, 409, "STAY_NOT_ACTIVE", "Stay is not active");
      }

      const meta = SERVICE_TYPE_META[body.serviceType];
      const tenantId = Ids.tenant(stayResult.tenantId);
      const hotelId = Ids.hotel(stayResult.stay.hotelId);
      const now = new Date().toISOString();
      await deps.ops.ensureStandardDepartments(tenantId, hotelId, now);
      const department = await deps.ops.findDepartmentByCode(
        tenantId,
        hotelId,
        meta.departmentCode,
      );
      if (!department) {
        return sendError(
          c,
          500,
          "DEPARTMENT_MISSING",
          "Housekeeping department not configured",
        );
      }

      const notePart = body.note ? ` · ${body.note}` : "";
      const created = await deps.ops.createTask({
        id: randomUUID(),
        tenantId,
        hotelId,
        departmentId: department.id,
        taskType: meta.taskType,
        title: `${meta.title} · חדר ${stayResult.stay.roomNumber}`,
        description: `${stayResult.stay.guestName} · חדר ${stayResult.stay.roomNumber}${notePart}`,
        priority: "medium",
        createdAt: now,
      });

      return c.json(
        {
          data: {
            taskId: created.id,
            serviceType: body.serviceType,
            status: created.status,
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/feedback", async (c) => {
    try {
      const body = feedbackSchema.parse(await c.req.json());
      const scope = await deps.guestStays.findBookingScope(body.bookingId);
      if (!scope) {
        return sendError(c, 404, "BOOKING_NOT_FOUND", "Booking not found");
      }

      const created = await deps.feedback.submit({
        id: randomUUID(),
        tenantId: Ids.tenant(scope.tenantId),
        hotelId: Ids.hotel(scope.hotelId),
        bookingId: scope.bookingId,
        rating: body.rating,
        categories: body.categories,
        ...(body.comment ? { comment: body.comment } : {}),
        source: "guest_app_survey",
        submittedAt: new Date().toISOString(),
      });

      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
