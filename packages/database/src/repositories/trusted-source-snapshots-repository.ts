import { and, desc, eq, inArray } from "drizzle-orm";
import type { TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { trustedSourceSnapshots } from "../schema/cio.js";
import { cosineSimilarity } from "./company-knowledge-repository.js";

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
  readonly embedding: readonly number[] | null;
  readonly embeddingModel: string | null;
  readonly embeddedAt: string | null;
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
  upsertEmbedding: (input: {
    readonly snapshotId: string;
    readonly tenantId: TenantId;
    readonly model: string;
    readonly embedding: readonly number[];
    readonly embeddedAt: string;
  }) => Promise<void>;
  searchSourcesBySnapshotEmbedding: (
    tenantId: TenantId,
    queryEmbedding: readonly number[],
    limit?: number,
  ) => Promise<readonly { readonly sourceId: string; readonly score: number }[]>;
};

function parseEmbeddingJson(raw: string): number[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "number")) {
    throw new Error("INVALID_EMBEDDING_JSON");
  }
  return parsed as number[];
}

function mapRow(
  row: typeof trustedSourceSnapshots.$inferSelect,
): PersistedTrustedSourceSnapshot {
  let embedding: readonly number[] | null = null;
  if (row.embeddingJson) {
    try {
      embedding = parseEmbeddingJson(row.embeddingJson);
    } catch {
      embedding = null;
    }
  }
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
    embedding,
    embeddingModel: row.embeddingModel ?? null,
    embeddedAt: row.embeddedAt ?? null,
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
        embeddingModel: null,
        embeddingDims: null,
        embeddingJson: null,
        embeddedAt: null,
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

    async upsertEmbedding(input) {
      await db
        .update(trustedSourceSnapshots)
        .set({
          embeddingModel: input.model,
          embeddingDims: String(input.embedding.length),
          embeddingJson: JSON.stringify(input.embedding),
          embeddedAt: input.embeddedAt,
        })
        .where(
          and(
            eq(trustedSourceSnapshots.tenantId, input.tenantId),
            eq(trustedSourceSnapshots.id, input.snapshotId),
          ),
        )
        .run();
    },

    async searchSourcesBySnapshotEmbedding(
      tenantId,
      queryEmbedding,
      limit = 6,
    ) {
      if (queryEmbedding.length === 0) return [];
      const rows = await db
        .select()
        .from(trustedSourceSnapshots)
        .where(
          and(
            eq(trustedSourceSnapshots.tenantId, tenantId),
            eq(trustedSourceSnapshots.status, "ok"),
          ),
        )
        .orderBy(desc(trustedSourceSnapshots.fetchedAt))
        .all();

      const bestBySource = new Map<string, number>();
      for (const row of rows) {
        if (!row.embeddingJson) continue;
        try {
          const embedding = parseEmbeddingJson(row.embeddingJson);
          const score = cosineSimilarity(queryEmbedding, embedding);
          if (score < 0.15) continue;
          const prev = bestBySource.get(row.sourceId) ?? -1;
          if (score > prev) bestBySource.set(row.sourceId, score);
        } catch {
          // skip corrupt
        }
      }

      return [...bestBySource.entries()]
        .map(([sourceId, score]) => ({ sourceId, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
