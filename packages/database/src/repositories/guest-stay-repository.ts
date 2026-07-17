import { and, eq, inArray } from "drizzle-orm";
import type { HotelOsDb } from "../client.js";
import { bookings, hotels, rooms } from "../schema/tenancy.js";

export type GuestStay = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly roomNumber: string;
  readonly guestName: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: string;
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

export type GuestStayRepository = {
  lookupByEmail: (email: string) => Promise<readonly GuestStay[]>;
  findBookingScope: (bookingId: string) => Promise<BookingScope | null>;
  checkInByEmail: (
    email: string,
    bookingId: string,
  ) => Promise<
    | { readonly ok: true; readonly stay: GuestStay }
    | { readonly ok: false; readonly reason: GuestCheckInError }
  >;
};

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
          checkInDate: bookings.checkInDate,
          checkOutDate: bookings.checkOutDate,
          status: bookings.status,
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

      return rows.map((row) => ({
        bookingId: row.bookingId,
        hotelId: row.hotelId,
        hotelName: row.hotelName,
        roomNumber: row.roomNumber,
        guestName: row.guestName,
        checkInDate: row.checkInDate,
        checkOutDate: row.checkOutDate,
        status: row.status,
      }));
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
      if (row.status !== "confirmed") {
        return { ok: false, reason: "NOT_CONFIRMED" };
      }

      await db
        .update(bookings)
        .set({ status: "checked_in" })
        .where(eq(bookings.id, bookingId))
        .run();

      await db
        .update(rooms)
        .set({ status: "occupied" })
        .where(eq(rooms.id, row.roomId))
        .run();

      return {
        ok: true,
        stay: {
          bookingId: row.bookingId,
          hotelId: row.hotelId,
          hotelName: row.hotelName,
          roomNumber: row.roomNumber,
          guestName: row.guestName,
          checkInDate: row.checkInDate,
          checkOutDate: row.checkOutDate,
          status: "checked_in",
        },
      };
    },
  };
}
