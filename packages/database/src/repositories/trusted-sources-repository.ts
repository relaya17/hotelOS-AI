import { asc, eq } from "drizzle-orm";
import type { TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { trustedSources } from "../schema/cio.js";

export type PersistedTrustedSource = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  readonly approvedAt: string;
  readonly approvedByUserId: string | null;
  readonly createdAt: string;
};

export type CreateTrustedSourceInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly url: string;
  readonly category: string;
  readonly approvedByUserId?: string;
  readonly createdAt: string;
};

export type TrustedSourcesRepository = {
  list: (tenantId: TenantId) => Promise<readonly PersistedTrustedSource[]>;
  create: (input: CreateTrustedSourceInput) => Promise<PersistedTrustedSource>;
};

function mapSource(
  row: typeof trustedSources.$inferSelect,
): PersistedTrustedSource {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    title: row.title,
    url: row.url,
    category: row.category,
    approvedAt: row.approvedAt,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt,
  };
}

export function createTrustedSourcesRepository(
  db: HotelOsDb,
): TrustedSourcesRepository {
  return {
    async list(tenantId) {
      const rows = await db
        .select()
        .from(trustedSources)
        .where(eq(trustedSources.tenantId, tenantId))
        .orderBy(asc(trustedSources.category))
        .all();
      return rows.map(mapSource);
    },

    async create(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        title: input.title,
        url: input.url,
        category: input.category,
        approvedAt: input.createdAt,
        approvedByUserId: input.approvedByUserId ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(trustedSources).values(row).run();
      return mapSource(row);
    },
  };
}
