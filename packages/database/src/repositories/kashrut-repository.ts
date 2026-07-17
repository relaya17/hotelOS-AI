import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { kashrutAnnotations } from "../schema/cio.js";

export type KashrutTargetKind =
  | "procurement"
  | "menu"
  | "briefing"
  | "event"
  | "other";
export type KashrutStatus = "ok" | "note" | "warn" | "block";

export type PersistedKashrutAnnotation = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly targetKind: KashrutTargetKind;
  readonly targetId: string;
  readonly status: KashrutStatus;
  readonly message: string | null;
  readonly createdByUserId: string | null;
  readonly createdAt: string;
};

export type CreateKashrutAnnotationInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly targetKind: KashrutTargetKind;
  readonly targetId: string;
  readonly status: KashrutStatus;
  readonly message?: string;
  readonly createdByUserId?: string;
  readonly createdAt: string;
};

export type KashrutRepository = {
  listByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    targetKind?: KashrutTargetKind,
  ) => Promise<readonly PersistedKashrutAnnotation[]>;
  listByTarget: (
    tenantId: TenantId,
    targetKind: KashrutTargetKind,
    targetId: string,
  ) => Promise<readonly PersistedKashrutAnnotation[]>;
  create: (
    input: CreateKashrutAnnotationInput,
  ) => Promise<PersistedKashrutAnnotation>;
};

function mapAnnotation(
  row: typeof kashrutAnnotations.$inferSelect,
): PersistedKashrutAnnotation {
  return {
    id: row.id,
    tenantId: Ids.tenant(row.tenantId),
    hotelId: Ids.hotel(row.hotelId),
    targetKind: row.targetKind as KashrutTargetKind,
    targetId: row.targetId,
    status: row.status as KashrutStatus,
    message: row.message,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
  };
}

export function createKashrutRepository(db: HotelOsDb): KashrutRepository {
  return {
    async listByHotel(tenantId, hotelId, targetKind) {
      const rows = await db
        .select()
        .from(kashrutAnnotations)
        .where(
          and(
            eq(kashrutAnnotations.tenantId, tenantId),
            eq(kashrutAnnotations.hotelId, hotelId),
            ...(targetKind
              ? [eq(kashrutAnnotations.targetKind, targetKind)]
              : []),
          ),
        )
        .orderBy(desc(kashrutAnnotations.createdAt))
        .all();
      return rows.map(mapAnnotation);
    },

    async listByTarget(tenantId, targetKind, targetId) {
      const rows = await db
        .select()
        .from(kashrutAnnotations)
        .where(
          and(
            eq(kashrutAnnotations.tenantId, tenantId),
            eq(kashrutAnnotations.targetKind, targetKind),
            eq(kashrutAnnotations.targetId, targetId),
          ),
        )
        .orderBy(desc(kashrutAnnotations.createdAt))
        .all();
      return rows.map(mapAnnotation);
    },

    async create(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        targetKind: input.targetKind,
        targetId: input.targetId,
        status: input.status,
        message: input.message ?? null,
        createdByUserId: input.createdByUserId ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(kashrutAnnotations).values(row).run();
      return mapAnnotation(row);
    },
  };
}
