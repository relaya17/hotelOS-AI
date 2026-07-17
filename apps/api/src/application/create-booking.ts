import { randomUUID } from "node:crypto";
import type { BookingRepository } from "@hotelos/database";
import type { AuditRepository } from "@hotelos/database";
import type { AuthPrincipal } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";

export type CreateBookingCommand = {
  readonly hotelId: string;
  readonly roomId: string;
  readonly guestName: string;
  readonly guestEmail: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly status: "confirmed" | "checked_in";
};

export type CreateBookingError = {
  readonly code:
    | "HOTEL_NOT_FOUND"
    | "ROOM_NOT_FOUND"
    | "ROOM_NOT_AVAILABLE"
    | "INVALID_DATES";
  readonly message: string;
};

export async function createBooking(
  bookings: BookingRepository,
  audit: AuditRepository,
  principal: AuthPrincipal,
  command: CreateBookingCommand,
): Promise<Result<Awaited<ReturnType<BookingRepository["create"]>>, CreateBookingError>> {
  const hotelId = Ids.hotel(command.hotelId);
  const roomId = Ids.room(command.roomId);

  const belongs = await bookings.hotelBelongsToTenant(
    principal.scope.tenantId,
    hotelId,
  );
  if (!belongs) {
    return err({
      code: "HOTEL_NOT_FOUND",
      message: "Hotel not found",
    });
  }

  if (command.checkOutDate <= command.checkInDate) {
    return err({
      code: "INVALID_DATES",
      message: "checkOutDate must be after checkInDate",
    });
  }

  const room = await bookings.findRoomInHotel(
    principal.scope.tenantId,
    hotelId,
    roomId,
  );
  if (!room) {
    return err({
      code: "ROOM_NOT_FOUND",
      message: "Room not found in hotel",
    });
  }

  if (command.status === "checked_in" && room.status !== "vacant") {
    return err({
      code: "ROOM_NOT_AVAILABLE",
      message: "Room is not vacant for check-in",
    });
  }

  const created = await bookings.create({
    id: Ids.booking(randomUUID()),
    tenantId: principal.scope.tenantId,
    hotelId,
    roomId,
    guestName: command.guestName.trim(),
    guestEmail: command.guestEmail.trim().toLowerCase(),
    checkInDate: command.checkInDate,
    checkOutDate: command.checkOutDate,
    status: command.status,
    createdAt: new Date().toISOString(),
  });

  await audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    hotelId,
    actorUserId: principal.userId,
    action: "booking.create",
    resourceType: "booking",
    resourceId: created.id,
    metadata: {
      roomId: created.roomId,
      status: created.status,
      guestEmail: created.guestEmail,
    },
    createdAt: new Date().toISOString(),
  });

  return ok(created);
}
