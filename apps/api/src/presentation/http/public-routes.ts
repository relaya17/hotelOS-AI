import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { FeedbackRepository, GuestStayRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { mapUnknownError, sendError } from "./errors.js";

export type PublicRouteDeps = {
  readonly guestStays: GuestStayRepository;
  readonly feedback: FeedbackRepository;
};

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

export function createPublicRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/stays/lookup", async (c) => {
    try {
      const body = lookupSchema.parse(await c.req.json());
      const stays = await deps.guestStays.lookupByEmail(body.email);
      return c.json({
        data: stays.map((stay) => ({
          bookingId: stay.bookingId,
          hotelId: stay.hotelId,
          hotelName: stay.hotelName,
          roomNumber: stay.roomNumber,
          guestName: stay.guestName,
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
          status: stay.status,
        })),
      });
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
          checkInDate: result.stay.checkInDate,
          checkOutDate: result.stay.checkOutDate,
          status: result.stay.status,
        },
      });
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
