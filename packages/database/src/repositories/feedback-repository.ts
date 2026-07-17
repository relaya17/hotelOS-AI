import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { guestFeedback } from "../schema/ops.js";

export type FeedbackSource = "guest_app_survey" | "manual" | "external_import";

export type PersistedGuestFeedback = {
  readonly id: string;
  readonly hotelId: string;
  readonly bookingId: string | null;
  readonly rating: number;
  readonly categories: readonly string[];
  readonly comment: string | null;
  readonly source: FeedbackSource;
  readonly submittedAt: string;
};

export type SubmitGuestFeedbackInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly bookingId?: string;
  readonly rating: number;
  readonly categories: readonly string[];
  readonly comment?: string;
  readonly source: FeedbackSource;
  readonly submittedAt: string;
};

function mapFeedback(row: typeof guestFeedback.$inferSelect): PersistedGuestFeedback {
  return {
    id: row.id,
    hotelId: row.hotelId,
    bookingId: row.bookingId ?? null,
    rating: row.rating,
    categories: JSON.parse(row.categoriesJson) as readonly string[],
    comment: row.comment ?? null,
    source: row.source as FeedbackSource,
    submittedAt: row.submittedAt,
  };
}

export type FeedbackRepository = {
  submit: (input: SubmitGuestFeedbackInput) => Promise<PersistedGuestFeedback>;
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedGuestFeedback[]>;
  averageRating: (tenantId: TenantId, hotelId: HotelId) => Promise<number | null>;
};

export function createFeedbackRepository(db: HotelOsDb): FeedbackRepository {
  return {
    async submit(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        bookingId: input.bookingId ?? null,
        rating: input.rating,
        categoriesJson: JSON.stringify(input.categories),
        comment: input.comment ?? null,
        source: input.source,
        submittedAt: input.submittedAt,
        createdAt: input.submittedAt,
      };
      await db.insert(guestFeedback).values(row).run();
      return mapFeedback(row);
    },

    async listByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(guestFeedback)
        .where(
          and(
            eq(guestFeedback.tenantId, tenantId),
            eq(guestFeedback.hotelId, hotelId),
          ),
        )
        .orderBy(desc(guestFeedback.submittedAt))
        .all();
      return rows.map(mapFeedback);
    },

    async averageRating(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(guestFeedback)
        .where(
          and(
            eq(guestFeedback.tenantId, tenantId),
            eq(guestFeedback.hotelId, hotelId),
          ),
        )
        .all();
      if (rows.length === 0) {
        return null;
      }
      const sum = rows.reduce((total, row) => total + row.rating, 0);
      return Math.round((sum / rows.length) * 10) / 10;
    },
  };
}
