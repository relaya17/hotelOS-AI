import type {
  AuditRepository,
  HotelRepository,
  OpsRepository,
  ReputationRepository,
  ReputationReviewSource,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  classifyReputationSentiment,
  extractReputationTopics,
  reputationNeedsFollowUp,
} from "./classify-reputation-sentiment.js";
import {
  mapReputationReview,
  type ReputationReviewProvider,
} from "./map-reputation-review.js";

/** Stable actor for public reputation webhook ingest (not a login session). */
export const REPUTATION_INGEST_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000r1",
);

const FRONT_OFFICE_DEPT_CODE = "front_office";

export type IngestReputationReviewDeps = {
  readonly hotels: HotelRepository;
  readonly ops: OpsRepository;
  readonly reputation: ReputationRepository;
  readonly audit: AuditRepository;
};

export type IngestReputationReviewResult =
  | {
      readonly ok: true;
      readonly reviewId: string;
      readonly hotelId: string;
      readonly source: ReputationReviewSource;
      readonly sentiment: "positive" | "neutral" | "negative";
      readonly taskId: string | null;
      readonly duplicate: boolean;
    }
  | {
      readonly ok: false;
      readonly code: "HOTEL_NOT_FOUND" | "FRONT_OFFICE_DEPT_MISSING";
      readonly message: string;
    };

export async function ingestReputationReview(
  deps: IngestReputationReviewDeps,
  input: {
    readonly provider: ReputationReviewProvider;
    readonly body: unknown;
    readonly tenantId?: TenantId;
    readonly actorUserId?: UserId;
    readonly publicIngest?: boolean;
  },
): Promise<IngestReputationReviewResult> {
  const mapped = mapReputationReview(input.provider, input.body);
  const tenantId = input.tenantId ?? Ids.tenant(DEMO_TENANT_ID);
  const actorUserId = input.actorUserId ?? REPUTATION_INGEST_ACTOR_USER_ID;
  const hotelId = Ids.hotel(mapped.hotelId);
  const source = input.provider as ReputationReviewSource;

  const hotel = await deps.hotels.findById(hotelId);
  if (!hotel || hotel.tenantId !== tenantId) {
    return {
      ok: false,
      code: "HOTEL_NOT_FOUND",
      message: "Hotel id from reputation review is not in this tenant",
    };
  }

  const existing = await deps.reputation.findBySourceExternalId(
    tenantId,
    source,
    mapped.externalId,
  );

  const sentiment = classifyReputationSentiment(
    mapped.rating,
    mapped.body,
    mapped.title,
  );
  const topics = extractReputationTopics(`${mapped.title ?? ""} ${mapped.body}`);
  const now = new Date().toISOString();

  const review = await deps.reputation.create({
    id: existing?.id ?? randomUUID(),
    tenantId,
    hotelId: hotelId as HotelId,
    source,
    externalId: mapped.externalId,
    rating: mapped.rating,
    ...(mapped.title !== undefined ? { title: mapped.title } : {}),
    body: mapped.body,
    ...(mapped.authorName !== undefined ? { authorName: mapped.authorName } : {}),
    ...(mapped.reviewUrl !== undefined ? { reviewUrl: mapped.reviewUrl } : {}),
    reviewedAt: mapped.reviewedAt,
    sentiment,
    topics,
    ...(existing?.taskId !== undefined && existing.taskId !== null
      ? { taskId: existing.taskId }
      : {}),
    createdAt: existing?.createdAt ?? now,
  });

  let taskId = review.taskId;
  const duplicate = existing !== null;

  if (
    taskId === null &&
    reputationNeedsFollowUp(mapped.rating, sentiment)
  ) {
    await deps.ops.ensureStandardDepartments(tenantId, hotelId, now);
    const dept = await deps.ops.findDepartmentByCode(
      tenantId,
      hotelId,
      FRONT_OFFICE_DEPT_CODE,
    );
    if (!dept) {
      return {
        ok: false,
        code: "FRONT_OFFICE_DEPT_MISSING",
        message: "Front office department not available",
      };
    }

    const author =
      mapped.authorName !== undefined ? ` · ${mapped.authorName}` : "";
    const titlePreview =
      mapped.title !== undefined && mapped.title.length > 0
        ? mapped.title
        : mapped.body.slice(0, 80);
    const task = await deps.ops.createTask({
      id: randomUUID(),
      tenantId,
      hotelId: hotelId as HotelId,
      departmentId: dept.id,
      taskType: "reputation_review",
      title: `ביקורת ${source} — ${mapped.rating}/5`,
      description: `[${source}] ${titlePreview}${author}\n\n${mapped.body.slice(0, 1500)}`,
      priority: "high",
      createdByUserId: actorUserId,
      createdAt: now,
    });
    taskId = task.id;
    await deps.reputation.linkTask(tenantId, review.id, task.id);
  }

  await deps.audit.append({
    id: randomUUID(),
    tenantId,
    actorUserId,
    action: "reputation.review.ingest",
    resourceType: "reputation_review",
    resourceId: review.id,
    metadata: {
      source,
      hotelId: mapped.hotelId,
      provider: input.provider,
      rating: mapped.rating,
      sentiment,
      topics: topics.join(","),
      ...(taskId !== null ? { taskId } : {}),
      ...(input.publicIngest === true ? { publicIngest: true } : {}),
      duplicate,
    },
    createdAt: now,
  });

  return {
    ok: true,
    reviewId: review.id,
    hotelId: mapped.hotelId,
    source,
    sentiment,
    taskId,
    duplicate,
  };
}
