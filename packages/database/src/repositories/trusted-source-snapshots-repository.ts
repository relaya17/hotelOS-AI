import { and, desc, eq, inArray } from "drizzle-orm";
import type { TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { trustedSourceSnapshots } from "../schema/cio.js";

export type PersistedTrustedSourceSnapshot = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly sourceId: string;
  readonly fetchedAt: string;
  readonly title: string;
  readonly summary: string;
  readonly checksum: string;
  readonly status: "ok" | "failed";
  readonly error: string | null;
  readonly createdAt: string;
};

export type CreateTrustedSourceSnapshotInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly sourceId: string;
  readonly fetchedAt: string;
  readonly title: string;
  readonly summary: string;
  readonly checksum: string;
  readonly status: "ok" | "failed";
  readonly error?: string | null;
  readonly createdAt: string;
};

export type TrustedSourceSnapshotsRepository = {
  create: (
    input: CreateTrustedSourceSnapshotInput,
  ) => Promise<PersistedTrustedSourceSnapshot>;
  listLatestByTenant: (
    tenantId: TenantId,
    options?: { readonly limit?: number },
  ) => Promise<readonly PersistedTrustedSourceSnapshot[]>;
  listLatestOkForSources: (
    tenantId: TenantId,
    sourceIds: readonly string[],
  ) => Promise<readonly PersistedTrustedSourceSnapshot[]>;
};

function mapRow(
  row: typeof trustedSourceSnapshots.$inferSelect,
): PersistedTrustedSourceSnapshot {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    sourceId: row.sourceId,
    fetchedAt: row.fetchedAt,
    title: row.title,
    summary: row.summary,
    checksum: row.checksum,
    status: row.status === "failed" ? "failed" : "ok",
    error: row.error,
    createdAt: row.createdAt,
  };
}

export function createTrustedSourceSnapshotsRepository(
  db: HotelOsDb,
): TrustedSourceSnapshotsRepository {
  return {
    async create(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        sourceId: input.sourceId,
        fetchedAt: input.fetchedAt,
        title: input.title,
        summary: input.summary,
        checksum: input.checksum,
        status: input.status,
        error: input.error ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(trustedSourceSnapshots).values(row).run();
      return mapRow(row);
    },

    async listLatestByTenant(tenantId, options) {
      const limit = options?.limit ?? 40;
      const rows = await db
        .select()
        .from(trustedSourceSnapshots)
        .where(eq(trustedSourceSnapshots.tenantId, tenantId))
        .orderBy(desc(trustedSourceSnapshots.fetchedAt))
        .limit(limit)
        .all();
      return rows.map(mapRow);
    },

    async listLatestOkForSources(tenantId, sourceIds) {
      if (sourceIds.length === 0) return [];
      const rows = await db
        .select()
        .from(trustedSourceSnapshots)
        .where(
          and(
            eq(trustedSourceSnapshots.tenantId, tenantId),
            eq(trustedSourceSnapshots.status, "ok"),
            inArray(trustedSourceSnapshots.sourceId, [...sourceIds]),
          ),
        )
        .orderBy(desc(trustedSourceSnapshots.fetchedAt))
        .all();

      const seen = new Set<string>();
      const latest: PersistedTrustedSourceSnapshot[] = [];
      for (const row of rows) {
        if (seen.has(row.sourceId)) continue;
        seen.add(row.sourceId);
        latest.push(mapRow(row));
      }
      return latest;
    },
  };
}
