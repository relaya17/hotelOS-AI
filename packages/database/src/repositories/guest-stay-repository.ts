import { and, eq, inArray } from "drizzle-orm";
import type { HotelOsDb } from "../client.js";
import { bookings, hotels, rooms } from "../schema/tenancy.js";
import type { RoomPrepStatus } from "./booking-repository.js";

export type GuestStay = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly guestPhone: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
  readonly roomPrepStatus: RoomPrepStatus | null;
  readonly roomStatus: string;
};

export type GuestFolioStay = {
  readonly bookingId: string;
  readonly roomNumber: string;
  readonly roomType: string | null;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly currency: string;
};

export type BookingScope = {
  readonly bookingId: string;
  readonly tenantId: string;
  readonly hotelId: string;
};

export type GuestCheckInError =
  | "BOOKING_NOT_FOUND"
  | "NOT_CONFIRMED"
  | "EMAIL_MISMATCH";

export type GuestCheckOutError =
  | "BOOKING_NOT_FOUND"
  | "NOT_CHECKED_IN"
  | "EMAIL_MISMATCH";

export type GuestServiceRequestError =
  | "BOOKING_NOT_FOUND"
  | "EMAIL_MISMATCH"
  | "STAY_NOT_ACTIVE";

export type GuestStayRepository = {
  lookupByEmail: (email: string) => Promise<readonly GuestStay[]>;
  findBookingScope: (bookingId: string) => Promise<BookingScope | null>;
  findActiveStayForEmail: (
    email: string,
    bookingId: string,
  ) => Promise<
    | { readonly ok: true; readonly stay: GuestStay; readonly tenantId: string }
    | { readonly ok: false; readonly reason: GuestServiceRequestError }
  >;
  findActiveFolioStayForEmail: (
    email: string,
    bookingId: string,
  ) => Promise<
    | { readonly ok: true; readonly stay: GuestFolioStay }
    | { readonly ok: false; readonly reason: GuestServiceRequestError }
  >;
  checkInByEmail: (
    email: string,
    bookingId: string,
  ) => Promise<
    | { readonly ok: true; readonly stay: GuestStay }
    | { readonly ok: false; readonly reason: GuestCheckInError }
  >;
  checkOutByEmail: (
    email: string,
    bookingId: string,
  ) => Promise<
    | { readonly ok: true; readonly stay: GuestStay }
    | { readonly ok: false; readonly reason: GuestCheckOutError }
  >;
};

const prepStatuses = new Set<string>([
  "waiting",
  "cleaning",
  "ready",
  "invited",
]);

function asPrep(value: string | null): RoomPrepStatus | null {
  if (value && prepStatuses.has(value)) {
    return value as RoomPrepStatus;
  }
  return null;
}

function mapStay(row: {
  bookingId: string;
  hotelId: string;
  hotelName: string;
  roomNumber: string;
  guestName: string;
  guestPhone: string | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  roomPrepStatus: string | null;
  roomStatus: string;
}): GuestStay {
  return {
    bookingId: row.bookingId,
    hotelId: row.hotelId,
    hotelName: row.hotelName,
    roomNumber: row.roomNumber,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: row.status,
    roomPrepStatus: asPrep(row.roomPrepStatus),
    roomStatus: row.roomStatus,
  };
}

export function createGuestStayRepository(db: HotelOsDb): GuestStayRepository {
  return {
    async lookupByEmail(email) {
      const normalized = email.trim().toLowerCase();
      const rows = await db
        .select({
          bookingId: bookings.id,
          hotelId: bookings.hotelId,
          hotelName: hotels.name,
          roomNumber: rooms.number,
          guestName: bookings.guestName,
          guestPhone: bookings.guestPhone,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          roomPrepStatus: bookings.roomPrepStatus,
          roomStatus: rooms.status,
        })
        .from(bookings)
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(
          and(
            eq(bookings.guestEmail, normalized),
            inArray(bookings.status, ["confirmed", "checked_in"]),
          ),
        )
        .all();

      return rows.map((row) =>
        mapStay({
          ...row,
          guestPhone: row.guestPhone ?? null,
          roomPrepStatus: row.roomPrepStatus ?? null,
        }),
      );
    },

    async findBookingScope(bookingId) {
      const row = await db
        .select({
          bookingId: bookings.id,
          tenantId: bookings.tenantId,
          hotelId: bookings.hotelId,
        })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .get();
      if (!row) {
        return null;
      }
      return row;
    },

    async findActiveStayForEmail(email, bookingId) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select({
          bookingId: bookings.id,
          tenantId: bookings.tenantId,
          hotelId: bookings.hotelId,
          hotelName: hotels.name,
          roomNumber: rooms.number,
          guestName: bookings.guestName,
          guestPhone: bookings.guestPhone,
          guestEmail: bookings.guestEmail,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          roomPrepStatus: bookings.roomPrepStatus,
          roomStatus: rooms.status,
        })
        .from(bookings)
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.id, bookingId))
        .get();

      if (!row) {
        return { ok: false, reason: "BOOKING_NOT_FOUND" };
      }
      if (row.guestEmail !== normalized) {
        return { ok: false, reason: "EMAIL_MISMATCH" };
      }
      if (row.status !== "confirmed" && row.status !== "checked_in") {
        return { ok: false, reason: "STAY_NOT_ACTIVE" };
      }

      return {
        ok: true,
        tenantId: row.tenantId,
        stay: mapStay({
          bookingId: row.bookingId,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          roomNumber: row.roomNumber,
          guestName: row.guestName,
          guestPhone: row.guestPhone ?? null,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          status: row.status,
          roomPrepStatus: row.roomPrepStatus ?? null,
          roomStatus: row.roomStatus,
        }),
      };
    },

    async findActiveFolioStayForEmail(email, bookingId) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select({
          bookingId: bookings.id,
          roomNumber: rooms.number,
          roomType: rooms.roomType,
          guestEmail: bookings.guestEmail,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          currency: hotels.currency,
        })
        .from(bookings)
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.id, bookingId))
        .get();

      if (!row) {
        return { ok: false, reason: "BOOKING_NOT_FOUND" };
      }
      if (row.guestEmail !== normalized) {
        return { ok: false, reason: "EMAIL_MISMATCH" };
      }
      if (row.status !== "confirmed" && row.status !== "checked_in") {
        return { ok: false, reason: "STAY_NOT_ACTIVE" };
      }

      return {
        ok: true,
        stay: {
          bookingId: row.bookingId,
          roomNumber: row.roomNumber,
          roomType: row.roomType,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          currency: row.currency,
        },
      };
    },

    async checkInByEmail(email, bookingId) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select({
          bookingId: bookings.id,
          hotelId: bookings.hotelId,
          hotelName: hotels.name,
          roomId: bookings.roomId,
          roomNumber: rooms.number,
          guestName: bookings.guestName,
          guestPhone: bookings.guestPhone,
          guestEmail: bookings.guestEmail,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
          roomStatus: rooms.status,
        })
        .from(bookings)
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.id, bookingId))
        .get();

      if (!row) {
        return { ok: false, reason: "BOOKING_NOT_FOUND" };
      }
      if (row.guestEmail !== normalized) {
        return { ok: false, reason: "EMAIL_MISMATCH" };
      }
      if (row.status !== "confirmed") {
        return { ok: false, reason: "NOT_CONFIRMED" };
      }

      await db
        .update(bookings)
        .set({ status: "checked_in", roomPrepStatus: null })
        .where(eq(bookings.id, bookingId))
        .run();

      await db
        .update(rooms)
        .set({ status: "occupied" })
        .where(eq(rooms.id, row.roomId))
        .run();

      return {
        ok: true,
        stay: mapStay({
          bookingId: row.bookingId,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          roomNumber: row.roomNumber,
          guestName: row.guestName,
          guestPhone: row.guestPhone ?? null,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          status: "checked_in",
          roomPrepStatus: null,
          roomStatus: "occupied",
        }),
      };
    },

    async checkOutByEmail(email, bookingId) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select({
          bookingId: bookings.id,
          tenantId: bookings.tenantId,
          hotelId: bookings.hotelId,
          hotelName: hotels.name,
          roomId: bookings.roomId,
          roomNumber: rooms.number,
          guestName: bookings.guestName,
          guestPhone: bookings.guestPhone,
          guestEmail: bookings.guestEmail,
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
        })
        .from(bookings)
        .innerJoin(hotels, eq(bookings.hotelId, hotels.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(eq(bookings.id, bookingId))
        .get();

      if (!row) {
        return { ok: false, reason: "BOOKING_NOT_FOUND" };
      }
      if (row.guestEmail !== normalized) {
        return { ok: false, reason: "EMAIL_MISMATCH" };
      }
      if (row.status !== "checked_in") {
        return { ok: false, reason: "NOT_CHECKED_IN" };
      }

      await db
        .update(bookings)
        .set({ status: "checked_out", roomPrepStatus: null })
        .where(eq(bookings.id, bookingId))
        .run();

      await db
        .update(rooms)
        .set({ status: "dirty" })
        .where(eq(rooms.id, row.roomId))
        .run();

      // Waiting arrivals on this room move to cleaning.
      await db
        .update(bookings)
        .set({ roomPrepStatus: "cleaning" })
        .where(
          and(
            eq(bookings.tenantId, row.tenantId),
            eq(bookings.hotelId, row.hotelId),
            eq(bookings.roomId, row.roomId),
            eq(bookings.roomPrepStatus, "waiting"),
          ),
        )
        .run();

      return {
        ok: true,
        stay: mapStay({
          bookingId: row.bookingId,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          roomNumber: row.roomNumber,
          guestName: row.guestName,
          guestPhone: row.guestPhone ?? null,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          status: "checked_out",
          roomPrepStatus: null,
          roomStatus: "dirty",
        }),
      };
    },
  };
}
