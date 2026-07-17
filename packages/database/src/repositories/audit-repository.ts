import type { CorrelationId, HotelId, TenantId, UserId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { auditEvents } from "../schema/tenancy.js";

export type AuditWrite = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId?: HotelId;
  readonly actorUserId?: UserId;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly correlationId?: CorrelationId;
  readonly metadata: Record<string, string | number | boolean | null>;
  readonly createdAt: string;
};

export type AuditRepository = {
  append: (event: AuditWrite) => Promise<void>;
};

export function createAuditRepository(db: HotelOsDb): AuditRepository {
  return {
    async append(event) {
      await db.insert(auditEvents)
        .values({
          id: event.id,
          tenantId: event.tenantId,
          hotelId: event.hotelId ?? null,
          actorUserId: event.actorUserId ?? null,
          action: event.action,
          resourceType: event.resourceType,
          resourceId: event.resourceId ?? null,
          correlationId: event.correlationId ?? null,
          metadataJson: JSON.stringify(event.metadata),
          createdAt: event.createdAt,
        })
        .run();
    },
  };
}
