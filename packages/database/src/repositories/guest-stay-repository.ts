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

export type GuestStayRepository = {
  lookupByEmail: (email: string) => Promise<readonly GuestStay[]>;
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
  };
}
