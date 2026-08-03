import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type AuditRepository,
  type AuditWrite,
  type CreateDepartmentTaskInput,
  type CreateReputationReviewInput,
  type HotelRepository,
  type OpsRepository,
  type PersistedHotel,
  type PersistedReputationReview,
  type ReputationRepository,
  type ReputationReviewSource,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import { ingestReputationReview } from "./ingest-reputation-review.js";

const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
const tenantId = Ids.tenant(DEMO_TENANT_ID);

const demoHotel: PersistedHotel = {
  id: hotelId,
  tenantId,
  chainId: "chain-demo",
  name: "TLV Demo",
  timezone: "Asia/Jerusalem",
  currency: "ILS",
  kashrutEnabled: false,
  enabledIntegrationDomains: [],
};

function hotelsOk(): HotelRepository {
  return {
    findById: async (id: HotelId) => (id === hotelId ? demoHotel : null),
  } as unknown as HotelRepository;
}

function reputationOk(): ReputationRepository & {
  created: CreateReputationReviewInput[];
  linked: { reviewId: string; taskId: string }[];
} {
  const store = new Map<string, PersistedReputationReview>();
  const created: CreateReputationReviewInput[] = [];
  const linked: { reviewId: string; taskId: string }[] = [];

  return {
    created,
    linked,
    findBySourceExternalId: async (
      _tenantId: TenantId,
      source: ReputationReviewSource,
      externalId: string,
    ) => {
      for (const row of store.values()) {
        if (row.source === source && row.externalId === externalId) {
          return row;
        }
      }
      return null;
    },
    create: async (input: CreateReputationReviewInput) => {
      created.push(input);
      const row: PersistedReputationReview = {
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
        topics: input.topics,
        taskId: input.taskId ?? null,
        createdAt: input.createdAt,
      };
      store.set(row.id, row);
      return row;
    },
    linkTask: async (_tenantId: TenantId, reviewId: string, taskId: string) => {
      linked.push({ reviewId, taskId });
      const row = store.get(reviewId);
      if (!row) return null;
      const updated = { ...row, taskId };
      store.set(reviewId, updated);
      return updated;
    },
    listByHotel: async () => [...store.values()],
    listRecent: async () => [...store.values()],
  } as unknown as ReputationRepository & {
    created: CreateReputationReviewInput[];
    linked: { reviewId: string; taskId: string }[];
  };
}

function opsOk(): OpsRepository & { created: CreateDepartmentTaskInput[] } {
  const created: CreateDepartmentTaskInput[] = [];
  return {
    created,
    ensureStandardDepartments: async () => undefined,
    findDepartmentByCode: async () => ({
      id: "dept-front",
      hotelId,
      code: "front_office",
      name: "Front office",
    }),
    createTask: async (input: CreateDepartmentTaskInput) => {
      created.push(input);
      return { ...input, status: "open" as const, updatedAt: input.createdAt };
    },
  } as unknown as OpsRepository & { created: CreateDepartmentTaskInput[] };
}

function auditOk(): AuditRepository & { rows: AuditWrite[] } {
  const rows: AuditWrite[] = [];
  return {
    rows,
    append: async (row: AuditWrite) => {
      rows.push(row);
    },
  } as unknown as AuditRepository & { rows: AuditWrite[] };
}

describe("ingestReputationReview", () => {
  it("creates a front-office task for a low Google review", async () => {
    const ops = opsOk();
    const reputation = reputationOk();
    const audit = auditOk();
    const result = await ingestReputationReview(
      { hotels: hotelsOk(), ops, reputation, audit },
      {
        provider: "google",
        body: {
          hotel_id: DEMO_HOTEL_TLV_ID,
          review_id: "g-low-1",
          star_rating: 2,
          comment: "Dirty room and rude staff",
          create_time: "2026-01-01T00:00:00.000Z",
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.sentiment, "negative");
    assert.notEqual(result.taskId, null);
    assert.equal(ops.created.length, 1);
    assert.equal(ops.created[0]?.taskType, "reputation_review");
    assert.equal(ops.created[0]?.priority, "high");
    assert.equal(reputation.linked.length, 1);
    assert.equal(audit.rows.length, 1);
  });

  it("does not duplicate tasks on idempotent re-ingest", async () => {
    const ops = opsOk();
    const reputation = reputationOk();
    const audit = auditOk();
    const deps = { hotels: hotelsOk(), ops, reputation, audit };
    const body = {
      hotel_id: DEMO_HOTEL_TLV_ID,
      review_id: "g-dup-1",
      star_rating: 1,
      comment: "Terrible",
      create_time: "2026-01-02T00:00:00.000Z",
    };
    const first = await ingestReputationReview(deps, {
      provider: "google",
      body,
    });
    const second = await ingestReputationReview(deps, {
      provider: "google",
      body,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.duplicate, true);
    assert.equal(ops.created.length, 1);
  });

  it("skips task for positive high rating", async () => {
    const ops = opsOk();
    const result = await ingestReputationReview(
      {
        hotels: hotelsOk(),
        ops,
        reputation: reputationOk(),
        audit: auditOk(),
      },
      {
        provider: "generic",
        body: {
          hotelId: DEMO_HOTEL_TLV_ID,
          externalId: "pos-1",
          rating: 5,
          body: "Excellent stay",
          reviewedAt: "2026-01-03T00:00:00.000Z",
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.taskId, null);
    assert.equal(ops.created.length, 0);
  });
});
