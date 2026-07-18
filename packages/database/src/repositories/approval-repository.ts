import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { aiApprovalRequests } from "../schema/ai.js";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type PersistedApprovalRequest = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string | null;
  readonly agentId: string;
  readonly requestedByUserId: string;
  readonly summaryHe: string;
  readonly reasonHe: string;
  readonly payloadJson: string;
  readonly status: ApprovalStatus;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
};

export type ApprovalRepository = {
  create: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly hotelId?: HotelId;
    readonly agentId: string;
    readonly requestedByUserId: UserId;
    readonly summaryHe: string;
    readonly reasonHe: string;
    readonly payloadJson: string;
    readonly createdAt: string;
  }) => Promise<PersistedApprovalRequest>;
  listPending: (tenantId: TenantId) => Promise<readonly PersistedApprovalRequest[]>;
  decide: (
    tenantId: TenantId,
    id: string,
    status: "approved" | "rejected",
    decidedByUserId: UserId,
    decidedAt: string,
  ) => Promise<PersistedApprovalRequest | null>;
};

function mapRow(
  row: typeof aiApprovalRequests.$inferSelect,
): PersistedApprovalRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId ?? null,
    agentId: row.agentId,
    requestedByUserId: row.requestedByUserId,
    summaryHe: row.summaryHe,
    reasonHe: row.reasonHe,
    payloadJson: row.payloadJson,
    status: row.status as ApprovalStatus,
    decidedByUserId: row.decidedByUserId ?? null,
    decidedAt: row.decidedAt ?? null,
    createdAt: row.createdAt,
  };
}

export function createApprovalRepository(db: HotelOsDb): ApprovalRepository {
  return {
    async create(input) {
      await db
        .insert(aiApprovalRequests)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId ?? null,
          agentId: input.agentId,
          requestedByUserId: input.requestedByUserId,
          summaryHe: input.summaryHe,
          reasonHe: input.reasonHe,
          payloadJson: input.payloadJson,
          status: "pending",
          decidedByUserId: null,
          decidedAt: null,
          createdAt: input.createdAt,
        })
        .run();
      const row = await db
        .select()
        .from(aiApprovalRequests)
        .where(eq(aiApprovalRequests.id, input.id))
        .get();
      if (!row) throw new Error("APPROVAL_CREATE_FAILED");
      return mapRow(row);
    },

    async listPending(tenantId) {
      const rows = await db
        .select()
        .from(aiApprovalRequests)
        .where(
          and(
            eq(aiApprovalRequests.tenantId, tenantId),
            eq(aiApprovalRequests.status, "pending"),
          ),
        )
        .orderBy(desc(aiApprovalRequests.createdAt))
        .all();
      return rows.map(mapRow);
    },

    async decide(tenantId, id, status, decidedByUserId, decidedAt) {
      await db
        .update(aiApprovalRequests)
        .set({
          status,
          decidedByUserId,
          decidedAt,
        })
        .where(
          and(
            eq(aiApprovalRequests.tenantId, tenantId),
            eq(aiApprovalRequests.id, id),
            eq(aiApprovalRequests.status, "pending"),
          ),
        )
        .run();
      const row = await db
        .select()
        .from(aiApprovalRequests)
        .where(
          and(
            eq(aiApprovalRequests.tenantId, tenantId),
            eq(aiApprovalRequests.id, id),
          ),
        )
        .get();
      return row ? mapRow(row) : null;
    },
  };
}
