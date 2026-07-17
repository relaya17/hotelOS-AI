import { and, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { hotels } from "../schema/tenancy.js";

export type PersistedHotel = {
  readonly id: HotelId;
  readonly tenantId: TenantId;
  readonly chainId: string;
  readonly name: string;
  readonly timezone: string;
  readonly currency: string;
  readonly kashrutEnabled: boolean;
};

export type HotelRepository = {
  listByTenant: (tenantId: TenantId) => Promise<readonly PersistedHotel[]>;
  setKashrutEnabled: (
    tenantId: TenantId,
    hotelId: HotelId,
    enabled: boolean,
  ) => Promise<PersistedHotel | null>;
};

function mapHotel(row: typeof hotels.$inferSelect): PersistedHotel {
  return {
    id: Ids.hotel(row.id),
    tenantId: Ids.tenant(row.tenantId),
    chainId: row.chainId,
    name: row.name,
    timezone: row.timezone,
    currency: row.currency,
    kashrutEnabled: row.kashrutEnabled === 1,
  };
}

export function createHotelRepository(db: HotelOsDb): HotelRepository {
  return {
    async listByTenant(tenantId) {
      const rows = await db
        .select()
        .from(hotels)
        .where(eq(hotels.tenantId, tenantId))
        .all();

      return rows.map(mapHotel);
    },

    async setKashrutEnabled(tenantId, hotelId, enabled) {
      const existing = await db
        .select()
        .from(hotels)
        .where(and(eq(hotels.id, hotelId), eq(hotels.tenantId, tenantId)))
        .get();
      if (!existing) {
        return null;
      }
      await db.update(hotels)
        .set({ kashrutEnabled: enabled ? 1 : 0 })
        .where(eq(hotels.id, hotelId))
        .run();
      return mapHotel({ ...existing, kashrutEnabled: enabled ? 1 : 0 });
    },
  };
}
