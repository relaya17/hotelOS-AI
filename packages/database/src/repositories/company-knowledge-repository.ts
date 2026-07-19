import { and, desc, eq } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  companyKnowledgeDocs,
  companyKnowledgeEmbeddings,
} from "../schema/ai.js";

export type PersistedCompanyKnowledgeDoc = {
  readonly id: string;
  readonly tenantId: string;
  readonly title: string;
  readonly body: string;
  readonly category: string;
  readonly status: string;
  readonly createdByUserId: string;
  readonly approvedByUserId: string | null;
  readonly approvedAt: string | null;
  readonly createdAt: string;
};

export type PersistedCompanyKnowledgeEmbedding = {
  readonly docId: string;
  readonly tenantId: string;
  readonly model: string;
  readonly dims: number;
  readonly embedding: readonly number[];
  readonly contentHash: string;
  readonly embeddedAt: string;
};

export type CompanyKnowledgeRepository = {
  list: (
    tenantId: TenantId,
    status?: string,
  ) => Promise<readonly PersistedCompanyKnowledgeDoc[]>;
  search: (
    tenantId: TenantId,
    query: string,
  ) => Promise<readonly PersistedCompanyKnowledgeDoc[]>;
  searchByEmbedding: (
    tenantId: TenantId,
    queryEmbedding: readonly number[],
    limit?: number,
  ) => Promise<readonly PersistedCompanyKnowledgeDoc[]>;
  create: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly title: string;
    readonly body: string;
    readonly category: string;
    readonly createdByUserId: UserId;
    readonly createdAt: string;
  }) => Promise<PersistedCompanyKnowledgeDoc>;
  approve: (
    tenantId: TenantId,
    id: string,
    approvedByUserId: UserId,
    approvedAt: string,
  ) => Promise<PersistedCompanyKnowledgeDoc | null>;
  getById: (
    tenantId: TenantId,
    id: string,
  ) => Promise<PersistedCompanyKnowledgeDoc | null>;
  upsertEmbedding: (input: {
    readonly docId: string;
    readonly tenantId: TenantId;
    readonly model: string;
    readonly embedding: readonly number[];
    readonly contentHash: string;
    readonly embeddedAt: string;
  }) => Promise<void>;
  getEmbedding: (
    tenantId: TenantId,
    docId: string,
  ) => Promise<PersistedCompanyKnowledgeEmbedding | null>;
};

function mapRow(
  row: typeof companyKnowledgeDocs.$inferSelect,
): PersistedCompanyKnowledgeDoc {
  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    body: row.body,
    category: row.category,
    status: row.status,
    createdByUserId: row.createdByUserId,
    approvedByUserId: row.approvedByUserId ?? null,
    approvedAt: row.approvedAt ?? null,
    createdAt: row.createdAt,
  };
}

function parseEmbeddingJson(raw: string): number[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "number")) {
    throw new Error("INVALID_EMBEDDING_JSON");
  }
  return parsed as number[];
}

export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function createCompanyKnowledgeRepository(
  db: HotelOsDb,
): CompanyKnowledgeRepository {
  return {
    async list(tenantId, status) {
      const rows = status
        ? await db
            .select()
            .from(companyKnowledgeDocs)
            .where(
              and(
                eq(companyKnowledgeDocs.tenantId, tenantId),
                eq(companyKnowledgeDocs.status, status),
              ),
            )
            .orderBy(desc(companyKnowledgeDocs.createdAt))
            .all()
        : await db
            .select()
            .from(companyKnowledgeDocs)
            .where(eq(companyKnowledgeDocs.tenantId, tenantId))
            .orderBy(desc(companyKnowledgeDocs.createdAt))
            .all();
      return rows.map(mapRow);
    },

    async search(tenantId, query) {
      const needle = query.trim().toLowerCase();
      if (needle.length < 2) return [];
      const rows = await db
        .select()
        .from(companyKnowledgeDocs)
        .where(
          and(
            eq(companyKnowledgeDocs.tenantId, tenantId),
            eq(companyKnowledgeDocs.status, "approved"),
          ),
        )
        .orderBy(desc(companyKnowledgeDocs.createdAt))
        .all();
      return rows
        .filter((row) => {
          const hay = `${row.title}\n${row.body}\n${row.category}`.toLowerCase();
          return hay.includes(needle);
        })
        .map(mapRow)
        .slice(0, 20);
    },

    async searchByEmbedding(tenantId, queryEmbedding, limit = 5) {
      if (queryEmbedding.length === 0) return [];
      const rows = await db
        .select({
          doc: companyKnowledgeDocs,
          embeddingJson: companyKnowledgeEmbeddings.embeddingJson,
        })
        .from(companyKnowledgeEmbeddings)
        .innerJoin(
          companyKnowledgeDocs,
          eq(companyKnowledgeEmbeddings.docId, companyKnowledgeDocs.id),
        )
        .where(
          and(
            eq(companyKnowledgeEmbeddings.tenantId, tenantId),
            eq(companyKnowledgeDocs.status, "approved"),
          ),
        )
        .all();

      const scored = rows
        .map((row) => {
          try {
            const embedding = parseEmbeddingJson(row.embeddingJson);
            return {
              doc: mapRow(row.doc),
              score: cosineSimilarity(queryEmbedding, embedding),
            };
          } catch {
            return null;
          }
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .filter((row) => row.score >= 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scored.map((row) => row.doc);
    },

    async create(input) {
      await db
        .insert(companyKnowledgeDocs)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          title: input.title,
          body: input.body,
          category: input.category,
          status: "pending_approval",
          createdByUserId: input.createdByUserId,
          approvedByUserId: null,
          approvedAt: null,
          createdAt: input.createdAt,
        })
        .run();
      const row = await db
        .select()
        .from(companyKnowledgeDocs)
        .where(eq(companyKnowledgeDocs.id, input.id))
        .get();
      if (!row) throw new Error("COMPANY_KNOWLEDGE_CREATE_FAILED");
      return mapRow(row);
    },

    async approve(tenantId, id, approvedByUserId, approvedAt) {
      await db
        .update(companyKnowledgeDocs)
        .set({
          status: "approved",
          approvedByUserId,
          approvedAt,
        })
        .where(
          and(
            eq(companyKnowledgeDocs.tenantId, tenantId),
            eq(companyKnowledgeDocs.id, id),
          ),
        )
        .run();
      return this.getById(tenantId, id);
    },

    async getById(tenantId, id) {
      const row = await db
        .select()
        .from(companyKnowledgeDocs)
        .where(
          and(
            eq(companyKnowledgeDocs.tenantId, tenantId),
            eq(companyKnowledgeDocs.id, id),
          ),
        )
        .get();
      return row ? mapRow(row) : null;
    },

    async upsertEmbedding(input) {
      const dims = String(input.embedding.length);
      const embeddingJson = JSON.stringify(input.embedding);
      const existing = await db
        .select()
        .from(companyKnowledgeEmbeddings)
        .where(eq(companyKnowledgeEmbeddings.docId, input.docId))
        .get();

      if (existing) {
        await db
          .update(companyKnowledgeEmbeddings)
          .set({
            tenantId: input.tenantId,
            model: input.model,
            dims,
            embeddingJson,
            contentHash: input.contentHash,
            embeddedAt: input.embeddedAt,
          })
          .where(eq(companyKnowledgeEmbeddings.docId, input.docId))
          .run();
        return;
      }

      await db
        .insert(companyKnowledgeEmbeddings)
        .values({
          docId: input.docId,
          tenantId: input.tenantId,
          model: input.model,
          dims,
          embeddingJson,
          contentHash: input.contentHash,
          embeddedAt: input.embeddedAt,
        })
        .run();
    },

    async getEmbedding(tenantId, docId) {
      const row = await db
        .select()
        .from(companyKnowledgeEmbeddings)
        .where(
          and(
            eq(companyKnowledgeEmbeddings.tenantId, tenantId),
            eq(companyKnowledgeEmbeddings.docId, docId),
          ),
        )
        .get();
      if (!row) return null;
      return {
        docId: row.docId,
        tenantId: row.tenantId,
        model: row.model,
        dims: Number(row.dims),
        embedding: parseEmbeddingJson(row.embeddingJson),
        contentHash: row.contentHash,
        embeddedAt: row.embeddedAt,
      };
    },
  };
}
