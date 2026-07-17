import { randomUUID } from "node:crypto";
import type { BookingRepository } from "@hotelos/database";
import type { AuditRepository } from "@hotelos/database";
import type { AuthPrincipal } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";

export type BookingTransition = "check_in" | "check_out";

export type UpdateBookingStatusCommand = {
  readonly hotelId: string;
  readonly bookingId: string;
  readonly transition: BookingTransition;
};

export type UpdateBookingStatusError = {
  readonly code:
    | "HOTEL_NOT_FOUND"
    | "BOOKING_NOT_FOUND"
    | "INVALID_TRANSITION"
    | "ROOM_NOT_AVAILABLE";
  readonly message: string;
};

export async function updateBookingStatus(
  bookings: BookingRepository,
  audit: AuditRepository,
  principal: AuthPrincipal,
  command: UpdateBookingStatusCommand,
): Promise<
  Result<
    NonNullable<Awaited<ReturnType<BookingRepository["updateStatus"]>>>,
    UpdateBookingStatusError
  >
> {
  const hotelId = Ids.hotel(command.hotelId);
  const bookingId = Ids.booking(command.bookingId);

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

  const existing = await bookings.findByIdInHotel(
    principal.scope.tenantId,
    hotelId,
    bookingId,
  );
  if (!existing) {
    return err({
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    });
  }

  if (command.transition === "check_in") {
    if (existing.status !== "confirmed") {
      return err({
        code: "INVALID_TRANSITION",
        message: "Only confirmed bookings can be checked in",
      });
    }
    const room = await bookings.findRoomInHotel(
      principal.scope.tenantId,
      hotelId,
      existing.roomId,
    );
    if (!room || room.status !== "vacant") {
      return err({
        code: "ROOM_NOT_AVAILABLE",
        message: "Room is not vacant for check-in",
      });
    }
  } else if (existing.status !== "checked_in") {
    return err({
      code: "INVALID_TRANSITION",
      message: "Only checked-in bookings can be checked out",
    });
  }

  const nextStatus =
    command.transition === "check_in" ? "checked_in" : "checked_out";
  const updated = await bookings.updateStatus(
    principal.scope.tenantId,
    hotelId,
    bookingId,
    nextStatus,
  );
  if (!updated) {
    return err({
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found",
    });
  }

  await audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    hotelId,
    actorUserId: principal.userId,
    action: `booking.${command.transition}`,
    resourceType: "booking",
    resourceId: updated.id,
    metadata: {
      fromStatus: existing.status,
      toStatus: updated.status,
      roomId: updated.roomId,
    },
    createdAt: new Date().toISOString(),
  });

  return ok(updated);
}
