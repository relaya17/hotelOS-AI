import { randomUUID } from "node:crypto";
import type { AuditRepository, RoomRepository, RoomStatus } from "@hotelos/database";
import type { AuthPrincipal } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";

export type UpdateRoomStatusCommand = {
  readonly hotelId: string;
  readonly roomId: string;
  readonly status: RoomStatus;
};

export type UpdateRoomStatusError = {
  readonly code: "HOTEL_NOT_FOUND" | "ROOM_NOT_FOUND";
  readonly message: string;
};

export async function updateRoomStatus(
  rooms: RoomRepository,
  audit: AuditRepository,
  principal: AuthPrincipal,
  command: UpdateRoomStatusCommand,
): Promise<
  Result<Awaited<ReturnType<RoomRepository["updateStatus"]>>, UpdateRoomStatusError>
> {
  const hotelId = Ids.hotel(command.hotelId);
  const roomId = Ids.room(command.roomId);

  const belongs = await rooms.hotelBelongsToTenant(
    principal.scope.tenantId,
    hotelId,
  );
  if (!belongs) {
    return err({
      code: "HOTEL_NOT_FOUND",
      message: "Hotel not found",
    });
  }

  const updated = await rooms.updateStatus(
    principal.scope.tenantId,
    hotelId,
    roomId,
    command.status,
  );
  if (!updated) {
    return err({
      code: "ROOM_NOT_FOUND",
      message: "Room not found in hotel",
    });
  }

  await audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    hotelId,
    actorUserId: principal.userId,
    action: "room.status.update",
    resourceType: "room",
    resourceId: updated.id,
    metadata: {
      status: updated.status,
    },
    createdAt: new Date().toISOString(),
  });

  return ok(updated);
}
