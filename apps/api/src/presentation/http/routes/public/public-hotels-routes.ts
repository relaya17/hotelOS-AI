import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { createPublicBooking } from "../../../../application/create-public-booking.js";
import { fireAutomationTrigger } from "../../../../application/fire-automation-trigger.js";
import { listPublicAvailability } from "../../../../application/public-availability.js";
import { quoteRoomStay } from "../../../../application/room-rates.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { PublicRouteDeps } from "./public-deps.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const publicBookSchema = z.object({
  roomType: z.string().trim().min(2).max(40),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(200),
  guestPhone: z.string().trim().min(6).max(40).optional(),
  checkInDate: dateSchema,
  checkOutDate: dateSchema,
});

export function createPublicHotelsRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.get("/hotels", async (c) => {
    try {
      const hotels = await deps.hotels.listAll();
      return c.json({
        data: hotels.map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          timezone: hotel.timezone,
          currency: hotel.currency,
          kashrutEnabled: hotel.kashrutEnabled,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/hotels/:hotelId", async (c) => {
    try {
      const hotel = await deps.hotels.findById(Ids.hotel(c.req.param("hotelId")));
      if (!hotel) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      return c.json({
        data: {
          id: hotel.id,
          name: hotel.name,
          timezone: hotel.timezone,
          currency: hotel.currency,
          kashrutEnabled: hotel.kashrutEnabled,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/hotels/:hotelId/availability", async (c) => {
    try {
      const checkInDate = c.req.query("checkIn");
      const checkOutDate = c.req.query("checkOut");
      const parsedIn = dateSchema.safeParse(checkInDate);
      const parsedOut = dateSchema.safeParse(checkOutDate);
      if (!parsedIn.success || !parsedOut.success) {
        return sendError(
          c,
          400,
          "VALIDATION_ERROR",
          "checkIn and checkOut query params (YYYY-MM-DD) required",
        );
      }
      if (parsedOut.data <= parsedIn.data) {
        return sendError(
          c,
          400,
          "INVALID_DATES",
          "checkOut must be after checkIn",
        );
      }
      const hotel = await deps.hotels.findById(Ids.hotel(c.req.param("hotelId")));
      if (!hotel) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      const offers = await listPublicAvailability({
        rooms: deps.rooms,
        bookings: deps.bookings,
        tenantId: hotel.tenantId,
        hotelId: hotel.id,
        checkInDate: parsedIn.data,
        checkOutDate: parsedOut.data,
      });
      return c.json({
        data: {
          hotelId: hotel.id,
          hotelName: hotel.name,
          currency: hotel.currency,
          checkInDate: parsedIn.data,
          checkOutDate: parsedOut.data,
          offers,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/hotels/:hotelId/quote", async (c) => {
    try {
      const body = z
        .object({
          roomType: z.string().trim().min(2).max(40),
          checkInDate: dateSchema,
          checkOutDate: dateSchema,
        })
        .parse(await c.req.json());
      if (body.checkOutDate <= body.checkInDate) {
        return sendError(
          c,
          400,
          "INVALID_DATES",
          "checkOutDate must be after checkInDate",
        );
      }
      const hotel = await deps.hotels.findById(Ids.hotel(c.req.param("hotelId")));
      if (!hotel) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      const quote = quoteRoomStay({
        roomType: body.roomType,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        currency: hotel.currency,
      });
      return c.json({ data: quote });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/hotels/:hotelId/bookings", async (c) => {
    try {
      const body = publicBookSchema.parse(await c.req.json());
      const result = await createPublicBooking(
        {
          hotels: deps.hotels,
          rooms: deps.rooms,
          bookings: deps.bookings,
          audit: deps.audit,
          trust: deps.trust,
          payments: deps.payments,
          ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
        },
        {
          hotelId: c.req.param("hotelId"),
          roomType: body.roomType,
          guestName: body.guestName,
          guestEmail: body.guestEmail,
          ...(body.guestPhone !== undefined
            ? { guestPhone: body.guestPhone }
            : {}),
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
        },
      );
      if (!result.ok) {
        const status =
          result.error.code === "HOTEL_NOT_FOUND"
            ? 404
            : result.error.code === "NO_AVAILABILITY"
              ? 409
              : result.error.code === "PAYMENT_FAILED"
                ? 502
                : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }
      await fireAutomationTrigger(
        {
          turbo: deps.turbo,
          ops: deps.ops,
          hotels: deps.hotels,
          ...(deps.pms ? { pms: deps.pms } : {}),
          audit: deps.audit,
        },
        {
          tenantId: result.value.booking.tenantId,
          hotelId: result.value.booking.hotelId,
          triggerKey: "booking.created",
          detail: `הזמנה ${result.value.booking.id} · ${result.value.booking.guestName} · ${result.value.booking.checkInDate}`,
          bookingId: result.value.booking.id,
          guestName: result.value.booking.guestName,
          checkInDate: result.value.booking.checkInDate,
          checkOutDate: result.value.booking.checkOutDate,
          roomType: body.roomType,
          roomNumber: result.value.booking.roomNumber,
        },
      );
      return c.json(
        {
          data: {
            bookingId: result.value.booking.id,
            hotelId: result.value.booking.hotelId,
            roomNumber: result.value.booking.roomNumber,
            guestName: result.value.booking.guestName,
            guestEmail: result.value.booking.guestEmail,
            checkInDate: result.value.booking.checkInDate,
            checkOutDate: result.value.booking.checkOutDate,
            status: result.value.booking.status,
            quote: result.value.quote,
            payment: result.value.payment,
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
