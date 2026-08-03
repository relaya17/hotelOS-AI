import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type {
  AuditRepository,
  BookingRepository,
  FeedbackRepository,
  GuestProfileRepository,
  GuestStayRepository,
  HotelRepository,
  HrRepository,
  OpsRepository,
  RoomRepository,
  TrustRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import {
  completeInviteSchema,
  completePublicInvite,
} from "./hr-routes.js";
import { buildGuestFolio } from "../../application/build-guest-folio.js";
import { createPublicBooking } from "../../application/create-public-booking.js";
import { listPublicAvailability } from "../../application/public-availability.js";
import { quoteRoomStay } from "../../application/room-rates.js";
import { mapUnknownError, sendError } from "./errors.js";

export type PublicRouteDeps = {
  readonly guestStays: GuestStayRepository;
  readonly feedback: FeedbackRepository;
  readonly hr: HrRepository;
  readonly ops: OpsRepository;
  readonly guestProfiles?: GuestProfileRepository;
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly audit: AuditRepository;
  readonly trust: TrustRepository;
};

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const publicBookSchema = z.object({
  roomType: z.string().trim().min(2).max(40),
  guestName: z.string().trim().min(2).max(120),
  guestEmail: z.string().email().max(200),
  guestPhone: z.string().trim().min(6).max(40).optional(),
  checkInDate: dateSchema,
  checkOutDate: dateSchema,
});

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

const serviceRequestSchema = z.object({
  email: z.string().email().max(200),
  bookingId: z.string().uuid(),
  serviceType: z.enum(["towels", "cleaning", "amenities"]),
  note: z.string().trim().max(1000).optional(),
});

export function createPublicRoutes(deps: PublicRouteDeps): Hono {
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
          guestPhone: stay.guestPhone,
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
          status: stay.status,
          roomPrepStatus: stay.roomPrepStatus,
          roomStatus: stay.roomStatus,
        })),
      });
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

  routes.get("/hr/invites/:token", async (c) => {
    try {
      const invite = await deps.hr.findInviteByToken(c.req.param("token"));
      if (!invite) {
        return sendError(c, 404, "INVITE_NOT_FOUND", "Invite not found");
      }
      if (invite.consumedAt) {
        return sendError(c, 409, "INVITE_CONSUMED", "Invite already used");
      }
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return sendError(c, 410, "INVITE_EXPIRED", "Invite expired");
      }
      return c.json({
        data: {
          email: invite.email,
          displayNameHint: invite.displayNameHint,
          roleHint: invite.roleHint,
          hotelId: invite.hotelId,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/hr/invites/:token/complete", async (c) => {
    try {
      const body = completeInviteSchema.parse(await c.req.json());
      const result = await completePublicInvite(
        deps.hr,
        c.req.param("token"),
        body,
      );
      if (!result.ok) {
        const map = {
          NOT_FOUND: [404, "INVITE_NOT_FOUND", "Invite not found"],
          EXPIRED: [410, "INVITE_EXPIRED", "Invite expired"],
          CONSUMED: [409, "INVITE_CONSUMED", "Invite already used"],
          EMAIL_TAKEN: [409, "EMAIL_TAKEN", "Email already registered"],
        } as const;
        const [status, code, message] = map[result.reason];
        return sendError(c, status, code, message);
      }
      return c.json(
        {
          data: {
            employeeId: result.employee.id,
            employeeCode: result.employee.employeeCode,
            userId: result.userId,
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
