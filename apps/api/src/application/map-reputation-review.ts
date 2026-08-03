import { z } from "@hotelos/validation";

export type ReputationReviewProvider =
  | "google"
  | "booking"
  | "tripadvisor"
  | "generic";

export const canonicalReputationReviewSchema = z.object({
  hotelId: z.string().uuid(),
  externalId: z.string().trim().min(1).max(160),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(300).optional(),
  body: z.string().trim().min(1).max(8000),
  authorName: z.string().trim().max(120).optional(),
  reviewUrl: z.string().url().max(500).optional(),
  reviewedAt: z.string().datetime(),
});

export type CanonicalReputationReview = z.infer<
  typeof canonicalReputationReviewSchema
>;

const googleSchema = z.object({
  hotel_id: z.string().uuid(),
  review_id: z.string().trim().min(1).max(160),
  star_rating: z.union([
    z.number().int().min(1).max(5),
    z.string().regex(/^[1-5]$/),
  ]),
  comment: z.string().trim().min(1).max(8000),
  reviewer_display_name: z.string().trim().max(120).optional(),
  create_time: z.string(),
  review_url: z.string().url().max(500).optional(),
});

const bookingSchema = z.object({
  property_id: z.string().uuid(),
  review_id: z.string().trim().min(1).max(160),
  score: z.union([
    z.number().min(1).max(10),
    z.string().regex(/^\d+(\.\d+)?$/),
  ]),
  title: z.string().trim().max(300).optional(),
  text: z.string().trim().min(1).max(8000),
  reviewer_name: z.string().trim().max(120).optional(),
  date: z.string(),
  url: z.string().url().max(500).optional(),
});

const tripadvisorSchema = z.object({
  location_id: z.string().uuid(),
  id: z.string().trim().min(1).max(160),
  rating: z.union([
    z.number().int().min(1).max(5),
    z.string().regex(/^[1-5]$/),
  ]),
  title: z.string().trim().max(300).optional(),
  text: z.string().trim().min(1).max(8000),
  username: z.string().trim().max(120).optional(),
  published_date: z.string(),
  url: z.string().url().max(500).optional(),
});

function parseRating(value: number | string): number {
  if (typeof value === "number") {
    return Math.min(5, Math.max(1, Math.round(value)));
  }
  const parsed = Number.parseInt(value, 10);
  return Math.min(5, Math.max(1, parsed));
}

/** Booking.com uses a 1–10 score; map to 1–5 stars. */
function bookingScoreToStars(score: number | string): number {
  const numeric =
    typeof score === "number" ? score : Number.parseFloat(score);
  if (!Number.isFinite(numeric)) {
    return 3;
  }
  return Math.min(5, Math.max(1, Math.round(numeric / 2)));
}

function normalizeTimestamp(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return new Date().toISOString();
  }
  return new Date(ms).toISOString();
}

export function mapReputationReview(
  provider: ReputationReviewProvider,
  body: unknown,
): CanonicalReputationReview {
  if (provider === "generic") {
    return canonicalReputationReviewSchema.parse(body);
  }

  if (provider === "google") {
    const parsed = googleSchema.parse(body);
    return canonicalReputationReviewSchema.parse({
      hotelId: parsed.hotel_id,
      externalId: parsed.review_id,
      rating: parseRating(parsed.star_rating),
      body: parsed.comment,
      ...(parsed.reviewer_display_name !== undefined
        ? { authorName: parsed.reviewer_display_name }
        : {}),
      reviewedAt: normalizeTimestamp(parsed.create_time),
      ...(parsed.review_url !== undefined
        ? { reviewUrl: parsed.review_url }
        : {}),
    });
  }

  if (provider === "booking") {
    const parsed = bookingSchema.parse(body);
    return canonicalReputationReviewSchema.parse({
      hotelId: parsed.property_id,
      externalId: parsed.review_id,
      rating: bookingScoreToStars(parsed.score),
      body: parsed.text,
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.reviewer_name !== undefined
        ? { authorName: parsed.reviewer_name }
        : {}),
      reviewedAt: normalizeTimestamp(parsed.date),
      ...(parsed.url !== undefined ? { reviewUrl: parsed.url } : {}),
    });
  }

  const parsed = tripadvisorSchema.parse(body);
  return canonicalReputationReviewSchema.parse({
    hotelId: parsed.location_id,
    externalId: parsed.id,
    rating: parseRating(parsed.rating),
    body: parsed.text,
    ...(parsed.title !== undefined ? { title: parsed.title } : {}),
    ...(parsed.username !== undefined ? { authorName: parsed.username } : {}),
    reviewedAt: normalizeTimestamp(parsed.published_date),
    ...(parsed.url !== undefined ? { reviewUrl: parsed.url } : {}),
  });
}
