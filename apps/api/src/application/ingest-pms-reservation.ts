import { randomUUID } from "node:crypto";
import type {
  AuditRepository,
  BookingRepository,
  GuestProfileRepository,
  HotelRepository,
  OpsRepository,
  RoomRepository,
  TurboRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";
import { pickAvailableRoom } from "./public-availability.js";
import { fireAutomationTrigger } from "./fire-automation-trigger.js";
import type { PmsConnector } from "@hotelos/connectors";

export type IngestPmsReservationCommand = {
  readonly hotelId: string;
  readonly externalReservationId: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly guestPhone?: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly roomType?: string;
  readonly roomNumber?: string;
};

export type IngestPmsReservationError = {
  readonly code:
    | "HOTEL_NOT_FOUND"
    | "INVALID_DATES"
    | "NO_AVAILABILITY"
    | "DUPLICATE";
  readonly message: string;
};

export type IngestPmsReservationResult = {
  readonly bookingId: string;
  readonly hotelId: string;
  readonly roomNumber: string;
  readonly status: string;
  readonly externalReservationId: string;
};

/**
 * Channel manager / PMS → HotelOS: create a confirmed booking without charging
 * (payment already handled on the OTA/PMS side).
 */
export async function ingestPmsReservation(
  deps: {
    readonly hotels: HotelRepository;
    readonly rooms: RoomRepository;
    readonly bookings: BookingRepository;
    readonly audit: AuditRepository;
    readonly turbo?: TurboRepository;
    readonly ops?: OpsRepository;
    readonly guestProfiles?: GuestProfileRepository;
    readonly pms?: PmsConnector;
  },
  command: IngestPmsReservationCommand,
): Promise<
  Result<IngestPmsReservationResult, IngestPmsReservationError>
> {
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

  const guestEmail = command.guestEmail.trim().toLowerCase();
  const existing = await deps.bookings.listByHotel(
    hotel.tenantId,
    hotel.id,
  );
  const duplicate = existing.find(
    (b) =>
      b.guestEmail === guestEmail &&
      b.checkInDate === command.checkInDate &&
      b.checkOutDate === command.checkOutDate &&
      b.status !== "cancelled",
  );
  if (duplicate) {
    return err({
      code: "DUPLICATE",
      message: `Reservation already ingested as booking ${duplicate.id}`,
    });
  }

  const roomType = command.roomType?.trim() || "standard";
  let room = await pickAvailableRoom({
    rooms: deps.rooms,
    bookings: deps.bookings,
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    roomType,
    checkInDate: command.checkInDate,
    checkOutDate: command.checkOutDate,
  });

  if (!room && command.roomNumber) {
    const rooms = await deps.rooms.listByHotel(hotel.tenantId, hotel.id);
    room =
      rooms.find(
        (r) => r.number === command.roomNumber && r.status !== "maintenance",
      ) ?? null;
  }

  if (!room) {
    return err({
      code: "NO_AVAILABILITY",
      message: "No rooms available for inbound PMS reservation",
    });
  }

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

  await deps.audit.append({
    id: randomUUID(),
    tenantId: hotel.tenantId,
    hotelId: hotel.id,
    action: "booking.create.pms_inbound",
    resourceType: "booking",
    resourceId: booking.id,
    metadata: {
      externalReservationId: command.externalReservationId,
      roomId: booking.roomId,
      roomType: room.roomType,
      guestEmail: booking.guestEmail,
      channel: "pms_inbound",
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
        noteHe: `הזמנת PMS/ערוץ · ${command.externalReservationId}`,
      });
    } catch {
      // never fail ingest on memory write
    }
  }

  if (deps.turbo) {
    await fireAutomationTrigger(
      {
        turbo: deps.turbo,
        ...(deps.ops ? { ops: deps.ops } : {}),
        hotels: deps.hotels,
        ...(deps.pms ? { pms: deps.pms } : {}),
        audit: deps.audit,
      },
      {
        tenantId: booking.tenantId,
        hotelId: booking.hotelId,
        triggerKey: "booking.created",
        detail: `PMS ${command.externalReservationId} · ${booking.guestName} · ${booking.checkInDate}`,
        bookingId: booking.id,
        guestName: booking.guestName,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        roomType: room.roomType,
        roomNumber: booking.roomNumber,
      },
    );
  }

  return ok({
    bookingId: booking.id,
    hotelId: booking.hotelId,
    roomNumber: booking.roomNumber,
    status: booking.status,
    externalReservationId: command.externalReservationId,
  });
}
