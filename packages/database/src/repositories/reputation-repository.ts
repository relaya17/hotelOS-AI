import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { reputationReviews } from "../schema/ops.js";

export type ReputationReviewSource =
  | "google"
  | "booking"
  | "tripadvisor"
  | "generic";

export type ReputationSentiment = "positive" | "neutral" | "negative";

export type PersistedReputationReview = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly source: ReputationReviewSource;
  readonly externalId: string;
  readonly rating: number;
  readonly title: string | null;
  readonly body: string;
  readonly authorName: string | null;
  readonly reviewUrl: string | null;
  readonly reviewedAt: string;
  readonly sentiment: ReputationSentiment;
  readonly topics: readonly string[];
  readonly taskId: string | null;
  readonly createdAt: string;
};

export type CreateReputationReviewInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly source: ReputationReviewSource;
  readonly externalId: string;
  readonly rating: number;
  readonly title?: string;
  readonly body: string;
  readonly authorName?: string;
  readonly reviewUrl?: string;
  readonly reviewedAt: string;
  readonly sentiment: ReputationSentiment;
  readonly topics: readonly string[];
  readonly taskId?: string;
  readonly createdAt: string;
};

function mapReview(
  row: typeof reputationReviews.$inferSelect,
): PersistedReputationReview {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId,
    source: row.source as ReputationReviewSource,
    externalId: row.externalId,
    rating: row.rating,
    title: row.title ?? null,
    body: row.body,
    authorName: row.authorName ?? null,
    reviewUrl: row.reviewUrl ?? null,
    reviewedAt: row.reviewedAt,
    sentiment: row.sentiment as ReputationSentiment,
    topics: JSON.parse(row.topicsJson) as readonly string[],
    taskId: row.taskId ?? null,
    createdAt: row.createdAt,
  };
}

export type ReputationRepository = {
  create: (
    input: CreateReputationReviewInput,
  ) => Promise<PersistedReputationReview>;
  findBySourceExternalId: (
    tenantId: TenantId,
    source: ReputationReviewSource,
    externalId: string,
  ) => Promise<PersistedReputationReview | null>;
  linkTask: (
    tenantId: TenantId,
    reviewId: string,
    taskId: string,
  ) => Promise<PersistedReputationReview | null>;
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedReputationReview[]>;
  listRecent: (
    tenantId: TenantId,
    hotelId: HotelId,
    options?: {
      readonly limit?: number;
      readonly sentiment?: ReputationSentiment;
    },
  ) => Promise<readonly PersistedReputationReview[]>;
};

export function createReputationRepository(db: HotelOsDb): ReputationRepository {
  return {
    async findBySourceExternalId(tenantId, source, externalId) {
      const row = await db
        .select()
        .from(reputationReviews)
        .where(
          and(
            eq(reputationReviews.tenantId, tenantId),
            eq(reputationReviews.source, source),
            eq(reputationReviews.externalId, externalId),
          ),
        )
        .get();
      return row ? mapReview(row) : null;
    },

    async create(input) {
      const existing = await db
        .select()
        .from(reputationReviews)
        .where(
          and(
            eq(reputationReviews.tenantId, input.tenantId),
            eq(reputationReviews.source, input.source),
            eq(reputationReviews.externalId, input.externalId),
          ),
        )
        .get();
      if (existing) {
        return mapReview(existing);
      }

      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        source: input.source,
        externalId: input.externalId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        authorName: input.authorName ?? null,
        reviewUrl: input.reviewUrl ?? null,
        reviewedAt: input.reviewedAt,
        sentiment: input.sentiment,
        topicsJson: JSON.stringify(input.topics),
        taskId: input.taskId ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(reputationReviews).values(row).run();
      return mapReview(row);
    },

    async linkTask(tenantId, reviewId, taskId) {
      await db
        .update(reputationReviews)
        .set({ taskId })
        .where(
          and(
            eq(reputationReviews.id, reviewId),
            eq(reputationReviews.tenantId, tenantId),
          ),
        )
        .run();
      const row = await db
        .select()
        .from(reputationReviews)
        .where(
          and(
            eq(reputationReviews.id, reviewId),
            eq(reputationReviews.tenantId, tenantId),
          ),
        )
        .get();
      return row ? mapReview(row) : null;
    },

    async listByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(reputationReviews)
        .where(
          and(
            eq(reputationReviews.tenantId, tenantId),
            eq(reputationReviews.hotelId, hotelId),
          ),
        )
        .orderBy(desc(reputationReviews.reviewedAt))
        .all();
      return rows.map(mapReview);
    },

    async listRecent(tenantId, hotelId, options) {
      const limit = options?.limit ?? 20;
      const rows = await db
        .select()
        .from(reputationReviews)
        .where(
          and(
            eq(reputationReviews.tenantId, tenantId),
            eq(reputationReviews.hotelId, hotelId),
            ...(options?.sentiment !== undefined
              ? [eq(reputationReviews.sentiment, options.sentiment)]
              : []),
          ),
        )
        .orderBy(desc(reputationReviews.reviewedAt))
        .limit(limit)
        .all();
      return rows.map(mapReview);
    },
  };
}
