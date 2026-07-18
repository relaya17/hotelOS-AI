import { and, desc, eq } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { companyKnowledgeDocs } from "../schema/ai.js";

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

export type CompanyKnowledgeRepository = {
  list: (
    tenantId: TenantId,
    status?: string,
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
  };
}
