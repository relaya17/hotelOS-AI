import { Hono } from "hono";
import type {
  AuditRepository,
  BookingRepository,
  HotelRepository,
  RoomRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { createBooking } from "../../application/create-booking.js";
import { updateBookingStatus } from "../../application/update-booking-status.js";
import { updateRoomStatus } from "../../application/update-room-status.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type HotelRouteDeps = {
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdParamSchema = z.string().uuid();

const createBookingSchema = z.object({
  roomId: z.string().uuid(),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(200),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["confirmed", "checked_in"]).default("confirmed"),
});

const roomIdParamSchema = z.string().uuid();
const bookingIdParamSchema = z.string().uuid();

const updateRoomStatusSchema = z.object({
  status: z.enum(["vacant", "occupied", "dirty", "maintenance"]),
});

const bookingTransitionSchema = z.object({
  transition: z.enum(["check_in", "check_out"]),
});

function toBookingDto(
  booking: Awaited<ReturnType<BookingRepository["create"]>>,
) {
  return {
    id: booking.id,
    roomId: booking.roomId,
    roomNumber: booking.roomNumber,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    status: booking.status,
  };
}

export function createHotelRoutes(deps: HotelRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.use("*", requireAuth(deps.tokens));

  routes.get("/", async (c) => {
    try {
      const principal = c.get("principal");
      const hotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      return c.json({
        data: hotels.map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          timezone: hotel.timezone,
          currency: hotel.currency,
          chainId: hotel.chainId,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/:hotelId/rooms", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelIdRaw = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const hotelId = Ids.hotel(hotelIdRaw);
      const belongs = await deps.rooms.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const rooms = await deps.rooms.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      return c.json({
        data: rooms.map((room) => ({
          id: room.id,
          number: room.number,
          floor: room.floor,
          roomType: room.roomType,
          status: room.status,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/:hotelId/bookings", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelIdRaw = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const hotelId = Ids.hotel(hotelIdRaw);
      const belongs = await deps.bookings.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const list = await deps.bookings.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      return c.json({
        data: list.map(toBookingDto),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:hotelId/bookings", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const body = createBookingSchema.parse(await c.req.json());
      const result = await createBooking(deps.bookings, deps.audit, principal, {
        hotelId,
        roomId: body.roomId,
        guestName: body.guestName,
        guestEmail: body.guestEmail,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        status: body.status,
      });

      if (!result.ok) {
        const status =
          result.error.code === "HOTEL_NOT_FOUND" ||
          result.error.code === "ROOM_NOT_FOUND"
            ? 404
            : 409;
        return sendError(c, status, result.error.code, result.error.message);
      }

      return c.json({ data: toBookingDto(result.value) }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/:hotelId/rooms/:roomId/status", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const roomId = roomIdParamSchema.parse(c.req.param("roomId"));
      const body = updateRoomStatusSchema.parse(await c.req.json());
      const result = await updateRoomStatus(deps.rooms, deps.audit, principal, {
        hotelId,
        roomId,
        status: body.status,
      });

      if (!result.ok) {
        const status = result.error.code === "HOTEL_NOT_FOUND" ? 404 : 404;
        return sendError(c, status, result.error.code, result.error.message);
      }

      const room = result.value;
      if (!room) {
        return sendError(c, 404, "ROOM_NOT_FOUND", "Room not found");
      }

      return c.json({
        data: {
          id: room.id,
          number: room.number,
          floor: room.floor,
          roomType: room.roomType,
          status: room.status,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:hotelId/bookings/:bookingId/status", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const bookingId = bookingIdParamSchema.parse(c.req.param("bookingId"));
      const body = bookingTransitionSchema.parse(await c.req.json());
      const result = await updateBookingStatus(
        deps.bookings,
        deps.audit,
        principal,
        {
          hotelId,
          bookingId,
          transition: body.transition,
        },
      );

      if (!result.ok) {
        const status =
          result.error.code === "HOTEL_NOT_FOUND" ||
          result.error.code === "BOOKING_NOT_FOUND"
            ? 404
            : 409;
        return sendError(c, status, result.error.code, result.error.message);
      }

      return c.json({ data: toBookingDto(result.value) });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
