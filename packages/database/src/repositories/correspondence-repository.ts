import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { letterDrafts } from "../schema/ai.js";

export type LetterKind = "formal_letter" | "purchase_note" | "speech";
export type LetterStatus = "draft" | "approved" | "discarded";

export type PersistedLetterDraft = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string | null;
  readonly kind: LetterKind;
  readonly subject: string;
  readonly recipientLabel: string;
  readonly body: string;
  readonly status: LetterStatus;
  readonly createdByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CorrespondenceRepository = {
  createDraft: (input: {
    readonly id: string;
    readonly tenantId: TenantId;
    readonly hotelId?: HotelId;
    readonly kind: LetterKind;
    readonly subject: string;
    readonly recipientLabel: string;
    readonly body: string;
    readonly createdByUserId: UserId;
    readonly createdAt: string;
  }) => Promise<PersistedLetterDraft>;
  listDrafts: (
    tenantId: TenantId,
    hotelId?: HotelId,
  ) => Promise<readonly PersistedLetterDraft[]>;
  getDraft: (
    tenantId: TenantId,
    draftId: string,
  ) => Promise<PersistedLetterDraft | null>;
  updateStatus: (
    tenantId: TenantId,
    draftId: string,
    status: LetterStatus,
    updatedAt: string,
  ) => Promise<PersistedLetterDraft | null>;
};

function mapDraft(row: typeof letterDrafts.$inferSelect): PersistedLetterDraft {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId ?? null,
    kind: row.kind as LetterKind,
    subject: row.subject,
    recipientLabel: row.recipientLabel,
    body: row.body,
    status: row.status as LetterStatus,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createCorrespondenceRepository(
  db: HotelOsDb,
): CorrespondenceRepository {
  return {
    async createDraft(input) {
      await db
        .insert(letterDrafts)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId ?? null,
          kind: input.kind,
          subject: input.subject,
          recipientLabel: input.recipientLabel,
          body: input.body,
          status: "draft",
          createdByUserId: input.createdByUserId,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        })
        .run();
      const row = await db
        .select()
        .from(letterDrafts)
        .where(eq(letterDrafts.id, input.id))
        .get();
      if (!row) throw new Error("LETTER_DRAFT_CREATE_FAILED");
      return mapDraft(row);
    },

    async listDrafts(tenantId, hotelId) {
      const rows = hotelId
        ? await db
            .select()
            .from(letterDrafts)
            .where(
              and(
                eq(letterDrafts.tenantId, tenantId),
                eq(letterDrafts.hotelId, hotelId),
              ),
            )
            .orderBy(desc(letterDrafts.createdAt))
            .all()
        : await db
            .select()
            .from(letterDrafts)
            .where(eq(letterDrafts.tenantId, tenantId))
            .orderBy(desc(letterDrafts.createdAt))
            .all();
      return rows.map(mapDraft);
    },

    async getDraft(tenantId, draftId) {
      const row = await db
        .select()
        .from(letterDrafts)
        .where(
          and(eq(letterDrafts.tenantId, tenantId), eq(letterDrafts.id, draftId)),
        )
        .get();
      return row ? mapDraft(row) : null;
    },

    async updateStatus(tenantId, draftId, status, updatedAt) {
      await db
        .update(letterDrafts)
        .set({ status, updatedAt })
        .where(
          and(eq(letterDrafts.tenantId, tenantId), eq(letterDrafts.id, draftId)),
        )
        .run();
      return this.getDraft(tenantId, draftId);
    },
  };
}
