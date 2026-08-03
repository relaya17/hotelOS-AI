import { and, desc, eq, sql } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { guestProfiles } from "../schema/tenancy.js";

export type PersistedGuestProfile = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly displayName: string;
  readonly phone: string | null;
  readonly notesHe: string | null;
  readonly preferencesJson: string;
  readonly stayCount: number;
  readonly lastHotelId: string | null;
  readonly lastStayAt: string | null;
  readonly marketingConsent: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RememberGuestStayInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly email: string;
  readonly displayName: string;
  readonly phone?: string | null;
  readonly hotelId: HotelId;
  readonly stayAt: string;
  readonly noteHe?: string;
};

export type GuestProfileRepository = {
  findByEmail: (
    tenantId: TenantId,
    email: string,
  ) => Promise<PersistedGuestProfile | null>;
  rememberStay: (
    input: RememberGuestStayInput,
  ) => Promise<PersistedGuestProfile>;
  listRecent: (
    tenantId: TenantId,
    options?: { readonly limit?: number },
  ) => Promise<readonly PersistedGuestProfile[]>;
  countByTenant: (tenantId: TenantId) => Promise<number>;
};

function mapRow(
  row: typeof guestProfiles.$inferSelect,
): PersistedGuestProfile {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    email: row.email,
    displayName: row.displayName,
    phone: row.phone,
    notesHe: row.notesHe,
    preferencesJson: row.preferencesJson,
    stayCount: row.stayCount,
    lastHotelId: row.lastHotelId,
    lastStayAt: row.lastStayAt,
    marketingConsent: row.marketingConsent === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createGuestProfileRepository(
  db: HotelOsDb,
): GuestProfileRepository {
  return {
    async findByEmail(tenantId, email) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select()
        .from(guestProfiles)
        .where(
          and(
            eq(guestProfiles.tenantId, tenantId),
            eq(guestProfiles.email, normalized),
          ),
        )
        .get();
      return row ? mapRow(row) : null;
    },

    async rememberStay(input) {
      const email = input.email.trim().toLowerCase();
      const existing = await db
        .select()
        .from(guestProfiles)
        .where(
          and(
            eq(guestProfiles.tenantId, input.tenantId),
            eq(guestProfiles.email, email),
          ),
        )
        .get();

      if (!existing) {
        const row = {
          id: input.id,
          tenantId: input.tenantId,
          email,
          displayName: input.displayName.trim(),
          phone: input.phone?.trim() || null,
          notesHe: input.noteHe?.trim() || null,
          preferencesJson: "{}",
          stayCount: 1,
          lastHotelId: input.hotelId,
          lastStayAt: input.stayAt,
          marketingConsent: 0,
          createdAt: input.stayAt,
          updatedAt: input.stayAt,
        };
        await db.insert(guestProfiles).values(row).run();
        return mapRow(row);
      }

      const notesHe = input.noteHe?.trim()
        ? [existing.notesHe, input.noteHe.trim()].filter(Boolean).join(" · ")
        : existing.notesHe;

      await db
        .update(guestProfiles)
        .set({
          displayName: input.displayName.trim() || existing.displayName,
          phone: input.phone?.trim() || existing.phone,
          notesHe,
          stayCount: existing.stayCount + 1,
          lastHotelId: input.hotelId,
          lastStayAt: input.stayAt,
          updatedAt: input.stayAt,
        })
        .where(eq(guestProfiles.id, existing.id))
        .run();

      const updated = await db
        .select()
        .from(guestProfiles)
        .where(eq(guestProfiles.id, existing.id))
        .get();
      return mapRow(updated!);
    },

    async listRecent(tenantId, options) {
      const limit = options?.limit ?? 20;
      const rows = await db
        .select()
        .from(guestProfiles)
        .where(eq(guestProfiles.tenantId, tenantId))
        .orderBy(desc(guestProfiles.lastStayAt))
        .limit(limit)
        .all();
      return rows.map(mapRow);
    },

    async countByTenant(tenantId) {
      const row = await db
        .select({ count: sql<number>`count(*)` })
        .from(guestProfiles)
        .where(eq(guestProfiles.tenantId, tenantId))
        .get();
      return Number(row?.count ?? 0);
    },
  };
}
