import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { revenueSuggestions } from "../schema/ops.js";

export type RevenueSuggestionStatus = "suggested" | "approved" | "rejected";

export type PersistedRevenueSuggestion = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currentOccupancyPct: number;
  readonly suggestedDeltaPct: number;
  readonly rationaleHe: string;
  readonly status: RevenueSuggestionStatus;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
};

export type CreateRevenueSuggestionInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currentOccupancyPct: number;
  readonly suggestedDeltaPct: number;
  readonly rationaleHe: string;
  readonly createdAt: string;
};

const statuses: readonly RevenueSuggestionStatus[] = [
  "suggested",
  "approved",
  "rejected",
];

function asStatus(value: string): RevenueSuggestionStatus {
  if ((statuses as readonly string[]).includes(value)) {
    return value as RevenueSuggestionStatus;
  }
  throw new Error("INVALID_REVENUE_SUGGESTION_STATUS");
}

function mapRow(
  row: typeof revenueSuggestions.$inferSelect,
): PersistedRevenueSuggestion {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    currentOccupancyPct: row.currentOccupancyPct,
    suggestedDeltaPct: row.suggestedDeltaPct,
    rationaleHe: row.rationaleHe,
    status: asStatus(row.status),
    decidedByUserId: row.decidedByUserId ?? null,
    decidedAt: row.decidedAt ?? null,
    createdAt: row.createdAt,
  };
}

export type RevenueSuggestionsRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    status?: RevenueSuggestionStatus,
  ) => Promise<readonly PersistedRevenueSuggestion[]>;
  findById: (
    tenantId: TenantId,
    suggestionId: string,
  ) => Promise<PersistedRevenueSuggestion | null>;
  createMany: (
    inputs: readonly CreateRevenueSuggestionInput[],
  ) => Promise<readonly PersistedRevenueSuggestion[]>;
  updateStatus: (
    tenantId: TenantId,
    suggestionId: string,
    status: RevenueSuggestionStatus,
    decidedByUserId: string,
    decidedAt: string,
  ) => Promise<PersistedRevenueSuggestion | null>;
  deleteSuggestedForPeriods: (
    tenantId: TenantId,
    hotelId: HotelId,
    periodStarts: readonly string[],
  ) => Promise<void>;
};

export function createRevenueSuggestionsRepository(
  db: HotelOsDb,
): RevenueSuggestionsRepository {
  return {
    async listByHotel(tenantId, hotelId, status) {
      const conditions = [
        eq(revenueSuggestions.tenantId, tenantId),
        eq(revenueSuggestions.hotelId, hotelId),
      ];
      if (status) {
        conditions.push(eq(revenueSuggestions.status, status));
      }
      const rows = await db
        .select()
        .from(revenueSuggestions)
        .where(and(...conditions))
        .orderBy(desc(revenueSuggestions.periodStart));
      return rows.map(mapRow);
    },

    async findById(tenantId, suggestionId) {
      const rows = await db
        .select()
        .from(revenueSuggestions)
        .where(
          and(
            eq(revenueSuggestions.tenantId, tenantId),
            eq(revenueSuggestions.id, suggestionId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? mapRow(row) : null;
    },

    async createMany(inputs) {
      if (inputs.length === 0) {
        return [];
      }
      await db.insert(revenueSuggestions).values(
        inputs.map((input) => ({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          currentOccupancyPct: input.currentOccupancyPct,
          suggestedDeltaPct: input.suggestedDeltaPct,
          rationaleHe: input.rationaleHe,
          status: "suggested",
          createdAt: input.createdAt,
        })),
      );
      const createdIds = inputs.map((input) => input.id);
      const rows = await db
        .select()
        .from(revenueSuggestions)
        .where(
          and(
            eq(revenueSuggestions.tenantId, inputs[0]!.tenantId),
            eq(revenueSuggestions.hotelId, inputs[0]!.hotelId),
          ),
        )
        .orderBy(desc(revenueSuggestions.periodStart));
      return rows.filter((row) => createdIds.includes(row.id)).map(mapRow);
    },

    async updateStatus(tenantId, suggestionId, status, decidedByUserId, decidedAt) {
      await db
        .update(revenueSuggestions)
        .set({
          status,
          decidedByUserId,
          decidedAt,
        })
        .where(
          and(
            eq(revenueSuggestions.tenantId, tenantId),
            eq(revenueSuggestions.id, suggestionId),
          ),
        );
      const rows = await db
        .select()
        .from(revenueSuggestions)
        .where(
          and(
            eq(revenueSuggestions.tenantId, tenantId),
            eq(revenueSuggestions.id, suggestionId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? mapRow(row) : null;
    },

    async deleteSuggestedForPeriods(tenantId, hotelId, periodStarts) {
      if (periodStarts.length === 0) {
        return;
      }
      const existing = await db
        .select()
        .from(revenueSuggestions)
        .where(
          and(
            eq(revenueSuggestions.tenantId, tenantId),
            eq(revenueSuggestions.hotelId, hotelId),
            eq(revenueSuggestions.status, "suggested"),
          ),
        );
      const toDelete = existing.filter((row) =>
        periodStarts.includes(row.periodStart),
      );
      for (const row of toDelete) {
        await db
          .delete(revenueSuggestions)
          .where(eq(revenueSuggestions.id, row.id));
      }
    },
  };
}
