import { Hono } from "hono";
import type {
  AuditRepository,
  BookingRepository,
  HotelRepository,
  NotificationRepository,
  RoomRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { createBooking } from "../../application/create-booking.js";
import { updateBookingRoomPrep } from "../../application/update-booking-room-prep.js";
import { updateBookingStatus } from "../../application/update-booking-status.js";
import { updateRoomStatus } from "../../application/update-room-status.js";
import type { WhatsAppProvider } from "../../infrastructure/whatsapp-provider.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type HotelRouteDeps = {
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly notifications: NotificationRepository;
  readonly whatsapp: WhatsAppProvider;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
  readonly guestProfiles?: import("@hotelos/database").GuestProfileRepository;
};

const hotelIdParamSchema = z.string().uuid();

const createBookingSchema = z.object({
  roomId: z.string().uuid(),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(200),
  guestPhone: z.string().trim().min(7).max(40).optional(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["confirmed", "checked_in"]).default("confirmed"),
});

function toNotificationDto(
  notification: {
    readonly id: string;
    readonly channel: string;
    readonly eventKey: string;
    readonly toAddress: string | null;
    readonly body: string;
    readonly status: string;
    readonly error: string | null;
    readonly provider: string;
    readonly attemptCount?: number;
    readonly nextAttemptAt?: string | null;
    readonly createdAt: string;
    readonly sentAt: string | null;
  } | null,
) {
  if (!notification) return null;
  return {
    id: notification.id,
    channel: notification.channel,
    eventKey: notification.eventKey,
    toAddress: notification.toAddress,
    body: notification.body,
    status: notification.status,
    error: notification.error,
    provider: notification.provider,
    attemptCount: notification.attemptCount ?? 0,
    nextAttemptAt: notification.nextAttemptAt ?? null,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
  };
}

const roomIdParamSchema = z.string().uuid();
const bookingIdParamSchema = z.string().uuid();

const updateRoomStatusSchema = z.object({
  status: z.enum(["vacant", "occupied", "dirty", "maintenance"]),
});

const updateKashrutSchema = z.object({
  enabled: z.boolean(),
});

const bookingTransitionSchema = z.object({
  transition: z.enum(["check_in", "check_out"]),
});

const roomPrepSchema = z.object({
  status: z.enum(["waiting", "invited"]),
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
    guestPhone: booking.guestPhone,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    status: booking.status,
    roomPrepStatus: booking.roomPrepStatus,
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
          kashrutEnabled: hotel.kashrutEnabled,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/:hotelId/kashrut", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = Ids.hotel(hotelIdParamSchema.parse(c.req.param("hotelId")));
      const body = updateKashrutSchema.parse(await c.req.json());
      const updated = await deps.hotels.setKashrutEnabled(
        principal.scope.tenantId,
        hotelId,
        body.enabled,
      );
      if (!updated) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      return c.json({
        data: {
          id: updated.id,
          name: updated.name,
          timezone: updated.timezone,
          currency: updated.currency,
          chainId: updated.chainId,
          kashrutEnabled: updated.kashrutEnabled,
        },
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
      const result = await createBooking(
        deps.bookings,
        deps.audit,
        principal,
        {
          hotelId,
          roomId: body.roomId,
          guestName: body.guestName,
          guestEmail: body.guestEmail,
          ...(body.guestPhone ? { guestPhone: body.guestPhone } : {}),
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          status: body.status,
        },
        deps.guestProfiles,
      );

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

  routes.patch("/:hotelId/bookings/:bookingId/room-prep", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const bookingId = bookingIdParamSchema.parse(c.req.param("bookingId"));
      const body = roomPrepSchema.parse(await c.req.json());
      const result = await updateBookingRoomPrep(
        deps.bookings,
        deps.audit,
        deps.notifications,
        deps.whatsapp,
        principal,
        {
          hotelId,
          bookingId,
          status: body.status,
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

      return c.json({
        data: {
          ...toBookingDto(result.value.booking),
          notification: toNotificationDto(result.value.notification),
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/:hotelId/notifications", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = Ids.hotel(hotelIdParamSchema.parse(c.req.param("hotelId")));
      const belongs = await deps.bookings.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      const list = await deps.notifications.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      return c.json({
        data: list.map((item) => toNotificationDto(item)),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
