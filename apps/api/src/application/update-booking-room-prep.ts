import { randomUUID } from "node:crypto";
import type {
  AuditRepository,
  BookingRepository,
  NotificationRepository,
  PersistedNotification,
  RoomPrepAction,
} from "@hotelos/database";
import type { AuthPrincipal } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";
import { enqueueRoomInviteNotification } from "./enqueue-room-invite-notification.js";
import type { WhatsAppProvider } from "../infrastructure/whatsapp-provider.js";

export type UpdateBookingRoomPrepCommand = {
  readonly hotelId: string;
  readonly bookingId: string;
  readonly status: RoomPrepAction;
};

export type UpdateBookingRoomPrepError = {
  readonly code:
    | "HOTEL_NOT_FOUND"
    | "BOOKING_NOT_FOUND"
    | "INVALID_STATUS"
    | "INVALID_TRANSITION";
  readonly message: string;
};

export type UpdateBookingRoomPrepResult = {
  readonly booking: NonNullable<
    Awaited<ReturnType<BookingRepository["findByIdInHotel"]>>
  >;
  readonly notification: PersistedNotification | null;
};

export async function updateBookingRoomPrep(
  bookings: BookingRepository,
  audit: AuditRepository,
  notifications: NotificationRepository,
  whatsapp: WhatsAppProvider,
  principal: AuthPrincipal,
  command: UpdateBookingRoomPrepCommand,
): Promise<Result<UpdateBookingRoomPrepResult, UpdateBookingRoomPrepError>> {
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

  const result = await bookings.setRoomPrep(
    principal.scope.tenantId,
    hotelId,
    bookingId,
    command.status,
  );

  if (!result.ok) {
    if (result.reason === "BOOKING_NOT_FOUND") {
      return err({
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found",
      });
    }
    if (result.reason === "INVALID_STATUS") {
      return err({
        code: "INVALID_STATUS",
        message: "Only confirmed bookings can wait for a room",
      });
    }
    return err({
      code: "INVALID_TRANSITION",
      message: "Room must be ready before inviting the guest",
    });
  }

  await audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    hotelId,
    actorUserId: principal.userId,
    action: `booking.room_prep.${command.status}`,
    resourceType: "booking",
    resourceId: result.booking.id,
    metadata: {
      roomPrepStatus: result.booking.roomPrepStatus,
      roomId: result.booking.roomId,
    },
    createdAt: new Date().toISOString(),
  });

  let notification: PersistedNotification | null = null;
  if (command.status === "invited") {
    notification = await enqueueRoomInviteNotification(
      notifications,
      whatsapp,
      result.booking,
    );
    await audit.append({
      id: randomUUID(),
      tenantId: principal.scope.tenantId,
      hotelId,
      actorUserId: principal.userId,
      action: "notification.room_invite",
      resourceType: "notification",
      resourceId: notification.id,
      metadata: {
        bookingId: result.booking.id,
        status: notification.status,
        channel: notification.channel,
        toAddress: notification.toAddress,
      },
      createdAt: new Date().toISOString(),
    });
  }

  return ok({ booking: result.booking, notification });
}
