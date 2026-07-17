import { and, desc, eq } from "drizzle-orm";
import type { BookingId, HotelId, RoomId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { bookings, hotels, rooms } from "../schema/tenancy.js";

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type PersistedBooking = {
  readonly id: BookingId;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly roomId: RoomId;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: BookingStatus;
  readonly roomNumber: string;
};

const bookingStatuses: readonly BookingStatus[] = [
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
];

function asBookingStatus(value: string): BookingStatus {
  if ((bookingStatuses as readonly string[]).includes(value)) {
    return value as BookingStatus;
  }
  throw new Error("INVALID_BOOKING_STATUS");
}

export type CreateBookingInput = {
  readonly id: BookingId;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly roomId: RoomId;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: BookingStatus;
  readonly createdAt: string;
};

export type BookingRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedBooking[]>;
  create: (input: CreateBookingInput) => Promise<PersistedBooking>;
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
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: asBookingStatus(row.status),
    roomNumber,
  };
}

export function createBookingRepository(db: HotelOsDb): BookingRepository {
  return {
    async hotelBelongsToTenant(tenantId, hotelId) {
      const row = db
        .select()
        .from(hotels)
        .where(and(eq(hotels.id, hotelId), eq(hotels.tenantId, tenantId)))
        .get();
      return row !== undefined;
    },

    async findRoomInHotel(tenantId, hotelId, roomId) {
      const row = db
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
      const rows = db
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

    async create(input) {
      db.insert(bookings)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          roomId: input.roomId,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          status: input.status,
          createdAt: input.createdAt,
        })
        .run();

      if (input.status === "checked_in") {
        db.update(rooms)
          .set({ status: "occupied" })
          .where(eq(rooms.id, input.roomId))
          .run();
      }

      const room = db
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
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          status: input.status,
          createdAt: input.createdAt,
        },
        room.number,
      );
    },
  };
}
