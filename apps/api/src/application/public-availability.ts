import type {
  BookingRepository,
  PersistedBooking,
  PersistedRoom,
  RoomRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { ROOM_TYPE_LABELS_HE, roomRateFor } from "./room-rates.js";

function datesOverlap(
  aIn: string,
  aOut: string,
  bIn: string,
  bOut: string,
): boolean {
  return aIn < bOut && bIn < aOut;
}

function isBlockingBooking(booking: PersistedBooking): boolean {
  return booking.status === "confirmed" || booking.status === "checked_in";
}

export function isRoomAvailableForDates(
  room: PersistedRoom,
  bookings: readonly PersistedBooking[],
  checkInDate: string,
  checkOutDate: string,
): boolean {
  if (room.status === "maintenance") return false;
  return !bookings.some(
    (booking) =>
      booking.roomId === room.id &&
      isBlockingBooking(booking) &&
      datesOverlap(
        checkInDate,
        checkOutDate,
        booking.checkInDate,
        booking.checkOutDate,
      ),
  );
}

export type AvailabilityOffer = {
  readonly roomType: string;
  readonly labelHe: string;
  readonly availableCount: number;
  readonly ratePerNight: number;
};

export async function listPublicAvailability(input: {
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly checkInDate: string;
  readonly checkOutDate: string;
}): Promise<readonly AvailabilityOffer[]> {
  const [roomRows, bookingRows] = await Promise.all([
    input.rooms.listByHotel(input.tenantId, input.hotelId),
    input.bookings.listByHotel(input.tenantId, input.hotelId),
  ]);

  const counts = new Map<string, number>();
  for (const room of roomRows) {
    if (
      !isRoomAvailableForDates(
        room,
        bookingRows,
        input.checkInDate,
        input.checkOutDate,
      )
    ) {
      continue;
    }
    const key = room.roomType.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([roomType, availableCount]) => ({
      roomType,
      labelHe: ROOM_TYPE_LABELS_HE[roomType] ?? roomType,
      availableCount,
      ratePerNight: roomRateFor(roomType),
    }))
    .sort((a, b) => a.ratePerNight - b.ratePerNight);
}

export async function pickAvailableRoom(input: {
  readonly rooms: RoomRepository;
  readonly bookings: BookingRepository;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly roomType: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
}): Promise<PersistedRoom | null> {
  const wanted = input.roomType.trim().toLowerCase();
  const [roomRows, bookingRows] = await Promise.all([
    input.rooms.listByHotel(input.tenantId, input.hotelId),
    input.bookings.listByHotel(input.tenantId, input.hotelId),
  ]);
  const candidates = roomRows
    .filter(
      (room) =>
        room.roomType.trim().toLowerCase() === wanted &&
        isRoomAvailableForDates(
          room,
          bookingRows,
          input.checkInDate,
          input.checkOutDate,
        ),
    )
    .sort((a, b) => a.number.localeCompare(b.number, "en"));
  return candidates[0] ?? null;
}
