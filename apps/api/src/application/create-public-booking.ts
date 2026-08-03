import { randomUUID } from "node:crypto";
import type {
  AuditRepository,
  BookingRepository,
  GuestProfileRepository,
  HotelRepository,
  RoomRepository,
  TrustRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";
import { pickAvailableRoom } from "./public-availability.js";
import { quoteRoomStay } from "./room-rates.js";

export type CreatePublicBookingCommand = {
  readonly hotelId: string;
  readonly roomType: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone?: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
};

export type CreatePublicBookingError = {
  readonly code:
    | "HOTEL_NOT_FOUND"
    | "INVALID_DATES"
    | "NO_AVAILABILITY"
    | "PAYMENT_FAILED";
  readonly message: string;
};

export type CreatePublicBookingResult = {
  readonly booking: Awaited<ReturnType<BookingRepository["create"]>>;
  readonly quote: ReturnType<typeof quoteRoomStay>;
  readonly payment: {
    readonly id: string;
    readonly status: string;
    readonly amountMinor: number;
    readonly currency: string;
  };
};

export async function createPublicBooking(
  deps: {
    readonly hotels: HotelRepository;
    readonly rooms: RoomRepository;
    readonly bookings: BookingRepository;
    readonly audit: AuditRepository;
    readonly trust: TrustRepository;
    readonly guestProfiles?: GuestProfileRepository;
  },
  command: CreatePublicBookingCommand,
): Promise<Result<CreatePublicBookingResult, CreatePublicBookingError>> {
  if (command.checkOutDate <= command.checkInDate) {
    return err({
      code: "INVALID_DATES",
      message: "checkOutDate must be after checkInDate",
    });
  }

  const hotel = await deps.hotels.findById(Ids.hotel(command.hotelId));
  if (!hotel) {
    return err({ code: "HOTEL_NOT_FOUND", message: "Hotel not found" });
  }

  const room = await pickAvailableRoom({
    rooms: deps.rooms,
    bookings: deps.bookings,
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    roomType: command.roomType,
    checkInDate: command.checkInDate,
    checkOutDate: command.checkOutDate,
  });
  if (!room) {
    return err({
      code: "NO_AVAILABILITY",
      message: "No rooms available for selected type and dates",
    });
  }

  const quote = quoteRoomStay({
    roomType: room.roomType,
    checkInDate: command.checkInDate,
    checkOutDate: command.checkOutDate,
    currency: hotel.currency,
  });

  const guestEmail = command.guestEmail.trim().toLowerCase();
  const now = new Date().toISOString();
  const booking = await deps.bookings.create({
    id: Ids.booking(randomUUID()),
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    roomId: room.id,
    guestName: command.guestName.trim(),
    guestEmail,
    guestPhone: command.guestPhone?.trim() || null,
    checkInDate: command.checkInDate,
    checkOutDate: command.checkOutDate,
    status: "confirmed",
    roomPrepStatus: "waiting",
    createdAt: now,
  });

  const paymentId = randomUUID();
  const intent = await deps.trust.createPaymentIntent({
    id: paymentId,
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    amountMinor: quote.amountMinor,
    currency: quote.currency,
    description: `הזמנה ציבורית ${booking.id} · ${quote.roomTypeLabelHe}`,
    payerEmail: guestEmail,
    createdAt: now,
  });
  const confirmed = await deps.trust.confirmPaymentIntent(
    hotel.tenantId,
    paymentId,
  );
  if (!confirmed || confirmed.status !== "succeeded") {
    return err({
      code: "PAYMENT_FAILED",
      message: "Demo payment confirmation failed",
    });
  }

  await deps.audit.append({
    id: randomUUID(),
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    action: "booking.create.public",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      roomId: booking.roomId,
      roomType: room.roomType,
      guestEmail: booking.guestEmail,
      paymentId,
      amountMinor: quote.amountMinor,
      channel: "public_book",
    },
    createdAt: now,
  });

  if (deps.guestProfiles) {
    try {
      await deps.guestProfiles.rememberStay({
        id: randomUUID(),
        tenantId: hotel.tenantId,
        email: booking.guestEmail,
        displayName: booking.guestName,
        phone: booking.guestPhone,
        hotelId: hotel.id,
        stayAt: now,
        noteHe: "הזמנה ציבורית (שולם)",
      });
    } catch {
      // never fail booking on memory write
    }
  }

  return ok({
    booking,
    quote,
    payment: {
      id: intent.id,
      status: confirmed.status,
      amountMinor: quote.amountMinor,
      currency: quote.currency,
    },
  });
}
