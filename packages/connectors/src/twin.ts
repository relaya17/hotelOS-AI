import type { PmsHotelInventory, PmsRoomStatus } from "./types.js";

export type TwinRoomNode = {
  readonly roomNumber: string;
  readonly status: PmsRoomStatus;
  readonly source: "hotelos" | "pms" | "merged";
  readonly externalRoomId?: string;
};

export type HotelTwinSnapshot = {
  readonly hotelId: string;
  readonly generatedAt: string;
  readonly rooms: readonly TwinRoomNode[];
  readonly pms?: {
    readonly providerId: string;
    readonly externalHotelId: string;
    readonly fetchedAt: string;
    readonly reservationCount: number;
  };
};

export function mergeHotelTwin(input: {
  readonly hotelId: string;
  readonly hotelosRooms: readonly {
    readonly roomNumber: string;
    readonly status: string;
  }[];
  readonly pms?: PmsHotelInventory;
}): HotelTwinSnapshot {
  const byNumber = new Map<string, TwinRoomNode>();

  for (const room of input.hotelosRooms) {
    byNumber.set(room.roomNumber, {
      roomNumber: room.roomNumber,
      status: asStatus(room.status),
      source: "hotelos",
    });
  }

  if (input.pms) {
    for (const room of input.pms.rooms) {
      const existing = byNumber.get(room.roomNumber);
      if (!existing) {
        byNumber.set(room.roomNumber, {
          roomNumber: room.roomNumber,
          status: room.status,
          source: "pms",
          externalRoomId: room.externalRoomId,
        });
        continue;
      }
      byNumber.set(room.roomNumber, {
        roomNumber: room.roomNumber,
        status: room.status === "unknown" ? existing.status : room.status,
        source: "merged",
        externalRoomId: room.externalRoomId,
      });
    }
  }

  return {
    hotelId: input.hotelId,
    generatedAt: new Date().toISOString(),
    rooms: [...byNumber.values()].sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
    ),
    ...(input.pms
      ? {
          pms: {
            providerId: input.pms.providerId,
            externalHotelId: input.pms.externalHotelId,
            fetchedAt: input.pms.fetchedAt,
            reservationCount: input.pms.reservations.length,
          },
        }
      : {}),
  };
}

function asStatus(value: string): PmsRoomStatus {
  if (
    value === "vacant" ||
    value === "occupied" ||
    value === "dirty" ||
    value === "maintenance"
  ) {
    return value;
  }
  return "unknown";
}
