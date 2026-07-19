import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { jobCandidates, jobPostings } from "../schema/ops.js";

/**
 * HR department recruiting tracker. Yad2 and most Israeli job boards have no
 * public API for automated posting or candidate scraping — this is a
 * link-based tracker (board name + external URL + manual candidate pipeline),
 * not a live integration. See docs/planning/facilities-ops-module.md.
 */
export type JobPostingStatus = "open" | "closed";
export type CandidateStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type PersistedJobPosting = {
  readonly id: string;
  readonly hotelId: string;
  readonly title: string;
  readonly boardName: string;
  readonly externalUrl: string | null;
  readonly status: JobPostingStatus;
  readonly createdAt: string;
};

export type CreateJobPostingInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly title: string;
  readonly boardName: string;
  readonly externalUrl?: string;
  readonly notes?: string;
  readonly createdByUserId?: string;
  readonly createdAt: string;
};

export type PersistedJobCandidate = {
  readonly id: string;
  readonly jobPostingId: string;
  readonly fullName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly source: string;
  readonly stage: CandidateStage;
};

export type AddCandidateInput = {
  readonly id: string;
  readonly jobPostingId: string;
  readonly fullName: string;
  readonly phone?: string;
  readonly email?: string;
  readonly source: string;
  readonly createdAt: string;
};

function mapPosting(row: typeof jobPostings.$inferSelect): PersistedJobPosting {
  return {
    id: row.id,
    hotelId: row.hotelId,
    title: row.title,
    boardName: row.boardName,
    externalUrl: row.externalUrl ?? null,
    status: row.status as JobPostingStatus,
    createdAt: row.createdAt,
  };
}

function mapCandidate(row: typeof jobCandidates.$inferSelect): PersistedJobCandidate {
  return {
    id: row.id,
    jobPostingId: row.jobPostingId,
    fullName: row.fullName,
    phone: row.phone ?? null,
    email: row.email ?? null,
    source: row.source,
    stage: row.stage as CandidateStage,
  };
}

export type RecruitingRepository = {
  listPostings: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedJobPosting[]>;
  findPostingInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    postingId: string,
  ) => Promise<PersistedJobPosting | null>;
  createPosting: (input: CreateJobPostingInput) => Promise<PersistedJobPosting>;
  closePosting: (
    tenantId: TenantId,
    hotelId: HotelId,
    postingId: string,
    closedAt: string,
  ) => Promise<PersistedJobPosting | null>;
  addCandidate: (input: AddCandidateInput) => Promise<PersistedJobCandidate>;
  listCandidates: (
    jobPostingId: string,
  ) => Promise<readonly PersistedJobCandidate[]>;
  findCandidateInHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    candidateId: string,
  ) => Promise<{
    readonly candidate: PersistedJobCandidate;
    readonly posting: PersistedJobPosting;
  } | null>;
  updateCandidateStage: (
    candidateId: string,
    stage: CandidateStage,
  ) => Promise<PersistedJobCandidate | null>;
};

export function createRecruitingRepository(db: HotelOsDb): RecruitingRepository {
  return {
    async listPostings(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(jobPostings)
        .where(
          and(eq(jobPostings.tenantId, tenantId), eq(jobPostings.hotelId, hotelId)),
        )
        .orderBy(desc(jobPostings.createdAt))
        .all();
      return rows.map(mapPosting);
    },

    async findPostingInHotel(tenantId, hotelId, postingId) {
      const row = await db
        .select()
        .from(jobPostings)
        .where(
          and(
            eq(jobPostings.id, postingId),
            eq(jobPostings.tenantId, tenantId),
            eq(jobPostings.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapPosting(row) : null;
    },

    async createPosting(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        title: input.title,
        boardName: input.boardName,
        externalUrl: input.externalUrl ?? null,
        status: "open" as const,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: input.createdAt,
        closedAt: null,
      };
      await db.insert(jobPostings).values(row).run();
      return mapPosting(row);
    },

    async closePosting(tenantId, hotelId, postingId, closedAt) {
      const existing = await db
        .select()
        .from(jobPostings)
        .where(
          and(
            eq(jobPostings.id, postingId),
            eq(jobPostings.tenantId, tenantId),
            eq(jobPostings.hotelId, hotelId),
          ),
        )
        .get();
      if (!existing) return null;
      await db
        .update(jobPostings)
        .set({ status: "closed", closedAt })
        .where(eq(jobPostings.id, postingId))
        .run();
      return mapPosting({ ...existing, status: "closed", closedAt });
    },

    async addCandidate(input) {
      const row = {
        id: input.id,
        jobPostingId: input.jobPostingId,
        fullName: input.fullName,
        phone: input.phone ?? null,
        email: input.email ?? null,
        source: input.source,
        stage: "applied" as const,
        notes: null,
        createdAt: input.createdAt,
      };
      await db.insert(jobCandidates).values(row).run();
      return mapCandidate(row);
    },

    async listCandidates(jobPostingId) {
      const rows = await db
        .select()
        .from(jobCandidates)
        .where(eq(jobCandidates.jobPostingId, jobPostingId))
        .all();
      return rows.map(mapCandidate);
    },

    async findCandidateInHotel(tenantId, hotelId, candidateId) {
      const row = await db
        .select({
          candidate: jobCandidates,
          posting: jobPostings,
        })
        .from(jobCandidates)
        .innerJoin(
          jobPostings,
          eq(jobCandidates.jobPostingId, jobPostings.id),
        )
        .where(
          and(
            eq(jobCandidates.id, candidateId),
            eq(jobPostings.tenantId, tenantId),
            eq(jobPostings.hotelId, hotelId),
          ),
        )
        .get();
      if (!row) return null;
      return {
        candidate: mapCandidate(row.candidate),
        posting: mapPosting(row.posting),
      };
    },

    async updateCandidateStage(candidateId, stage) {
      await db.update(jobCandidates)
        .set({ stage })
        .where(eq(jobCandidates.id, candidateId))
        .run();

      const row = await db
        .select()
        .from(jobCandidates)
        .where(eq(jobCandidates.id, candidateId))
        .get();
      return row ? mapCandidate(row) : null;
    },
  };
}
