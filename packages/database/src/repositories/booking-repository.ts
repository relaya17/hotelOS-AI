import { and, desc, eq, inArray } from "drizzle-orm";
import type { BookingId, HotelId, RoomId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { bookings, hotels, rooms } from "../schema/tenancy.js";

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type RoomPrepStatus = "waiting" | "cleaning" | "ready" | "invited";

export type PersistedBooking = {
  readonly id: BookingId;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly roomId: RoomId;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: BookingStatus;
  readonly roomPrepStatus: RoomPrepStatus | null;
  readonly roomNumber: string;
};

export type RoomPrepAction = "waiting" | "invited";

export type RoomPrepError =
  | "BOOKING_NOT_FOUND"
  | "INVALID_STATUS"
  | "INVALID_TRANSITION";

const bookingStatuses: readonly BookingStatus[] = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
];

const roomPrepStatuses: readonly RoomPrepStatus[] = [
  "waiting",
  "cleaning",
  "ready",
  "invited",
];

function asBookingStatus(value: string): BookingStatus {
  if ((bookingStatuses as readonly string[]).includes(value)) {
    return value as BookingStatus;
  }
  throw new Error("INVALID_BOOKING_STATUS");
}

function asRoomPrepStatus(value: string | null): RoomPrepStatus | null {
  if (value === null || value === undefined) {
    return null;
  }
  if ((roomPrepStatuses as readonly string[]).includes(value)) {
    return value as RoomPrepStatus;
  }
  return null;
}

export type CreateBookingInput = {
  readonly id: BookingId;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly roomId: RoomId;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone?: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: BookingStatus;
  readonly roomPrepStatus?: RoomPrepStatus | null;
  readonly createdAt: string;
};

export type BookingRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedBooking[]>;
  create: (input: CreateBookingInput) => Promise<PersistedBooking>;
  findByIdInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
  ) => Promise<PersistedBooking | null>;
  updateStatus: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
    status: BookingStatus,
  ) => Promise<PersistedBooking | null>;
  setRoomPrep: (
    tenantId: TenantId,
    hotelId: HotelId,
    bookingId: BookingId,
    action: RoomPrepAction,
  ) => Promise<
    | { readonly ok: true; readonly booking: PersistedBooking }
    | { readonly ok: false; readonly reason: RoomPrepError }
  >;
  advanceRoomPrepForDirtyRoom: (
    tenantId: TenantId,
    hotelId: HotelId,
    roomId: RoomId,
  ) => Promise<void>;
  advanceRoomPrepForVacantRoom: (
    tenantId: TenantId,
    hotelId: HotelId,
    roomId: RoomId,
  ) => Promise<void>;
  findRoomInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    roomId: RoomId,
  ) => Promise<{ id: RoomId; number: string; status: string } | null>;
  hotelBelongsToTenant: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<boolean>;
};

function mapBooking(
  row: typeof bookings.$inferSelect,
  roomNumber: string,
): PersistedBooking {
  return {
    id: Ids.booking(row.id),
    tenantId: Ids.tenant(row.tenantId),
    hotelId: Ids.hotel(row.hotelId),
    roomId: Ids.room(row.roomId),
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone ?? null,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: asBookingStatus(row.status),
    roomPrepStatus: asRoomPrepStatus(row.roomPrepStatus ?? null),
    roomNumber,
  };
}

function resolveWaitingPrep(roomStatus: string): RoomPrepStatus {
  if (roomStatus === "vacant") return "ready";
  if (roomStatus === "dirty") return "cleaning";
  return "waiting";
}

export function createBookingRepository(db: HotelOsDb): BookingRepository {
  return {
    async hotelBelongsToTenant(tenantId, hotelId) {
      const row = await db
        .select()
        .from(hotels)
        .where(and(eq(hotels.id, hotelId), eq(hotels.tenantId, tenantId)))
        .get();
      return row !== undefined;
    },

    async findRoomInHotel(tenantId, hotelId, roomId) {
      const row = await db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.id, roomId),
            eq(rooms.hotelId, hotelId),
            eq(rooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!row) {
        return null;
      }
      return {
        id: Ids.room(row.id),
        number: row.number,
        status: row.status,
      };
    },

    async listByHotel(tenantId, hotelId) {
      const rows = await db
        .select({
          booking: bookings,
          roomNumber: rooms.number,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(
          and(eq(bookings.tenantId, tenantId), eq(bookings.hotelId, hotelId)),
        )
        .orderBy(desc(bookings.checkInDate))
        .all();

      return rows.map((row) => mapBooking(row.booking, row.roomNumber));
    },

    async findByIdInHotel(tenantId, hotelId, bookingId) {
      const row = await db
        .select({
          booking: bookings,
          roomNumber: rooms.number,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.tenantId, tenantId),
          ),
        )
        .get();
      if (!row) {
        return null;
      }
      return mapBooking(row.booking, row.roomNumber);
    },

    async updateStatus(tenantId, hotelId, bookingId, status) {
      const existing = await db
        .select({
          booking: bookings,
          roomNumber: rooms.number,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.tenantId, tenantId),
          ),
        )
        .get();
      if (!existing) {
        return null;
      }

      const nextPrep =
        status === "checked_in" ? null : existing.booking.roomPrepStatus;

      await db
        .update(bookings)
        .set({ status, roomPrepStatus: nextPrep })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.tenantId, tenantId),
          ),
        )
        .run();

      if (status === "checked_in") {
        await db
          .update(rooms)
          .set({ status: "occupied" })
          .where(eq(rooms.id, existing.booking.roomId))
          .run();
      } else if (status === "checked_out") {
        await db
          .update(rooms)
          .set({ status: "dirty" })
          .where(eq(rooms.id, existing.booking.roomId))
          .run();
        await db
          .update(bookings)
          .set({ roomPrepStatus: "cleaning" })
          .where(
            and(
              eq(bookings.tenantId, tenantId),
              eq(bookings.hotelId, hotelId),
              eq(bookings.roomId, existing.booking.roomId),
              eq(bookings.roomPrepStatus, "waiting"),
            ),
          )
          .run();
      }

      return mapBooking(
        {
          ...existing.booking,
          status,
          roomPrepStatus: nextPrep,
        },
        existing.roomNumber,
      );
    },

    async setRoomPrep(tenantId, hotelId, bookingId, action) {
      const existing = await db
        .select({
          booking: bookings,
          roomNumber: rooms.number,
          roomStatus: rooms.status,
        })
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.tenantId, tenantId),
          ),
        )
        .get();

      if (!existing) {
        return { ok: false, reason: "BOOKING_NOT_FOUND" };
      }

      if (action === "waiting") {
        if (existing.booking.status !== "confirmed") {
          return { ok: false, reason: "INVALID_STATUS" };
        }
        const next = resolveWaitingPrep(existing.roomStatus);
        await db
          .update(bookings)
          .set({ roomPrepStatus: next })
          .where(eq(bookings.id, bookingId))
          .run();
        return {
          ok: true,
          booking: mapBooking(
            { ...existing.booking, roomPrepStatus: next },
            existing.roomNumber,
          ),
        };
      }

      // invited
      if (asRoomPrepStatus(existing.booking.roomPrepStatus ?? null) !== "ready") {
        return { ok: false, reason: "INVALID_TRANSITION" };
      }
      await db
        .update(bookings)
        .set({ roomPrepStatus: "invited" })
        .where(eq(bookings.id, bookingId))
        .run();
      return {
        ok: true,
        booking: mapBooking(
          { ...existing.booking, roomPrepStatus: "invited" },
          existing.roomNumber,
        ),
      };
    },

    async advanceRoomPrepForDirtyRoom(tenantId, hotelId, roomId) {
      await db
        .update(bookings)
        .set({ roomPrepStatus: "cleaning" })
        .where(
          and(
            eq(bookings.tenantId, tenantId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.roomId, roomId),
            eq(bookings.roomPrepStatus, "waiting"),
          ),
        )
        .run();
    },

    async advanceRoomPrepForVacantRoom(tenantId, hotelId, roomId) {
      await db
        .update(bookings)
        .set({ roomPrepStatus: "ready" })
        .where(
          and(
            eq(bookings.tenantId, tenantId),
            eq(bookings.hotelId, hotelId),
            eq(bookings.roomId, roomId),
            inArray(bookings.roomPrepStatus, ["waiting", "cleaning"]),
          ),
        )
        .run();
    },

    async create(input) {
      await db.insert(bookings)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          roomId: input.roomId,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone ?? null,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          status: input.status,
          roomPrepStatus: input.roomPrepStatus ?? null,
          createdAt: input.createdAt,
        })
        .run();

      if (input.status === "checked_in") {
        await db.update(rooms)
          .set({ status: "occupied" })
          .where(eq(rooms.id, input.roomId))
          .run();
      }

      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .get();
      if (!room) {
        throw new Error("ROOM_MISSING_AFTER_CREATE");
      }

      return mapBooking(
        {
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          roomId: input.roomId,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone ?? null,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          status: input.status,
          roomPrepStatus: input.roomPrepStatus ?? null,
          createdAt: input.createdAt,
        },
        room.number,
      );
    },
  };
}
