import { and, eq, inArray } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { bookings, hotels, rooms, tenants } from "../schema/tenancy.js";

export type HotelOverview = {
  readonly id: HotelId;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly chainId: string;
  readonly rooms: {
    readonly total: number;
    readonly vacant: number;
    readonly occupied: number;
    readonly dirty: number;
    readonly maintenance: number;
  };
  readonly bookings: {
    readonly confirmed: number;
    readonly checkedIn: number;
    readonly active: number;
  };
};

export type ChainOverview = {
  readonly tenantId: TenantId;
  readonly tenantName: string;
  readonly hotelCount: number;
  readonly hotels: readonly HotelOverview[];
};

export type OverviewRepository = {
  getChainOverview: (tenantId: TenantId) => Promise<ChainOverview | null>;
};

export function createOverviewRepository(db: HotelOsDb): OverviewRepository {
  return {
    async getChainOverview(tenantId) {
      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .get();
      if (!tenant) {
        return null;
      }

      const hotelRows = await db
        .select()
        .from(hotels)
        .where(eq(hotels.tenantId, tenantId))
        .all();

      const overviews: HotelOverview[] = [];
      for (const hotel of hotelRows) {
        const roomRows = await db
          .select()
          .from(rooms)
          .where(
            and(eq(rooms.tenantId, tenantId), eq(rooms.hotelId, hotel.id)),
          )
          .all();

        const roomCounts = {
          total: roomRows.length,
          vacant: roomRows.filter((row) => row.status === "vacant").length,
          occupied: roomRows.filter((row) => row.status === "occupied").length,
          dirty: roomRows.filter((row) => row.status === "dirty").length,
          maintenance: roomRows.filter((row) => row.status === "maintenance")
            .length,
        };

        const bookingRows = await db
          .select()
          .from(bookings)
          .where(
            and(
              eq(bookings.tenantId, tenantId),
              eq(bookings.hotelId, hotel.id),
              inArray(bookings.status, ["confirmed", "checked_in"]),
            ),
          )
          .all();

        const confirmed = bookingRows.filter(
          (row) => row.status === "confirmed",
        ).length;
        const checkedIn = bookingRows.filter(
          (row) => row.status === "checked_in",
        ).length;

        overviews.push({
          id: Ids.hotel(hotel.id),
          name: hotel.name,
          timezone: hotel.timezone,
          currency: hotel.currency,
          chainId: hotel.chainId,
          rooms: roomCounts,
          bookings: {
            confirmed,
            checkedIn,
            active: confirmed + checkedIn,
          },
        });
      }

      return {
        tenantId: Ids.tenant(tenant.id),
        tenantName: tenant.name,
        hotelCount: overviews.length,
        hotels: overviews,
      };
    },
  };
}
