import { and, eq } from "drizzle-orm";
import type { HotelId, RoomId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { hotels, rooms } from "../schema/tenancy.js";

export type RoomStatus = "vacant" | "occupied" | "dirty" | "maintenance";

export type PersistedRoom = {
  readonly id: RoomId;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly number: string;
  readonly floor: string;
  readonly roomType: string;
  readonly status: RoomStatus;
};

const roomStatuses: readonly RoomStatus[] = [
  "vacant",
  "occupied",
  "dirty",
  "maintenance",
];

function asRoomStatus(value: string): RoomStatus {
  if ((roomStatuses as readonly string[]).includes(value)) {
    return value as RoomStatus;
  }
  throw new Error("INVALID_ROOM_STATUS");
}

export type RoomRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedRoom[]>;
  findByIdInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    roomId: RoomId,
  ) => Promise<PersistedRoom | null>;
  updateStatus: (
    tenantId: TenantId,
    hotelId: HotelId,
    roomId: RoomId,
    status: RoomStatus,
  ) => Promise<PersistedRoom | null>;
  hotelBelongsToTenant: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<boolean>;
};

export function createRoomRepository(db: HotelOsDb): RoomRepository {
  return {
    async hotelBelongsToTenant(tenantId, hotelId) {
      const row = await db
        .select()
        .from(hotels)
        .where(and(eq(hotels.id, hotelId), eq(hotels.tenantId, tenantId)))
        .get();
      return row !== undefined;
    },

    async listByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(rooms)
        .where(and(eq(rooms.tenantId, tenantId), eq(rooms.hotelId, hotelId)))
        .all();

      return rows.map((row) => ({
        id: Ids.room(row.id),
        tenantId: Ids.tenant(row.tenantId),
        hotelId: Ids.hotel(row.hotelId),
        number: row.number,
        floor: row.floor,
        roomType: row.roomType,
        status: asRoomStatus(row.status),
      }));
    },

    async findByIdInHotel(tenantId, hotelId, roomId) {
      const row = await db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.id, roomId),
            eq(rooms.hotelId, hotelId),
            eq(rooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!row) {
        return null;
      }
      return {
        id: Ids.room(row.id),
        tenantId: Ids.tenant(row.tenantId),
        hotelId: Ids.hotel(row.hotelId),
        number: row.number,
        floor: row.floor,
        roomType: row.roomType,
        status: asRoomStatus(row.status),
      };
    },

    async updateStatus(tenantId, hotelId, roomId, status) {
      const existing = await db
        .select()
        .from(rooms)
        .where(
          and(
            eq(rooms.id, roomId),
            eq(rooms.hotelId, hotelId),
            eq(rooms.tenantId, tenantId),
          ),
        )
        .get();
      if (!existing) {
        return null;
      }

      await db
        .update(rooms)
        .set({ status })
        .where(
          and(
            eq(rooms.id, roomId),
            eq(rooms.hotelId, hotelId),
            eq(rooms.tenantId, tenantId),
          ),
        )
        .run();

      return {
        id: Ids.room(existing.id),
        tenantId: Ids.tenant(existing.tenantId),
        hotelId: Ids.hotel(existing.hotelId),
        number: existing.number,
        floor: existing.floor,
        roomType: existing.roomType,
        status,
      };
    },
  };
}
