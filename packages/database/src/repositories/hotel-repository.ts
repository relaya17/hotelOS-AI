import { eq } from "drizzle-orm";
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
};

export type HotelRepository = {
  listByTenant: (tenantId: TenantId) => Promise<readonly PersistedHotel[]>;
};

export function createHotelRepository(db: HotelOsDb): HotelRepository {
  return {
    async listByTenant(tenantId) {
      const rows = await db
        .select()
        .from(hotels)
        .where(eq(hotels.tenantId, tenantId))
        .all();

      return rows.map((row) => ({
        id: Ids.hotel(row.id),
        tenantId: Ids.tenant(row.tenantId),
        chainId: row.chainId,
        name: row.name,
        timezone: row.timezone,
        currency: row.currency,
      }));
    },
  };
}
