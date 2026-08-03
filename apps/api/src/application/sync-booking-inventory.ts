import { randomUUID } from "node:crypto";
import type { PmsConnector } from "@hotelos/connectors";
import type { AuditRepository } from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";

export type SyncBookingInventoryInput = {
  readonly tenantId: TenantId | string;
  readonly hotelId: HotelId | string;
  readonly bookingId: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly roomType?: string;
  readonly roomNumber?: string | null;
  readonly guestName?: string;
};

export type SyncBookingInventoryResult = {
  readonly status: "accepted" | "skipped";
  readonly detail: string;
  readonly providerId?: string;
};

/**
 * Outbound inventory hint to the configured PMS / channel connector.
 * Card / money paths are never involved — soft distribution sync only.
 */
export async function syncBookingInventory(
  deps: {
    readonly pms?: PmsConnector;
    readonly audit?: AuditRepository;
  },
  input: SyncBookingInventoryInput,
): Promise<SyncBookingInventoryResult> {
  if (!deps.pms?.notifyInventoryChanged) {
    return {
      status: "skipped",
      detail: "PMS connector has no inventory notify path",
    };
  }

  const notified = await deps.pms.notifyInventoryChanged({
    hotelId: String(input.hotelId),
    bookingId: input.bookingId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    ...(input.roomType !== undefined ? { roomType: input.roomType } : {}),
    ...(input.roomNumber !== undefined
      ? { roomNumber: input.roomNumber }
      : {}),
    ...(input.guestName !== undefined ? { guestName: input.guestName } : {}),
  });

  if (deps.audit) {
    try {
      await deps.audit.append({
        id: randomUUID(),
        tenantId: Ids.tenant(String(input.tenantId)),
        hotelId: Ids.hotel(String(input.hotelId)),
        action: "pms.inventory.notify",
        resourceType: "booking",
        resourceId: input.bookingId,
        metadata: {
          providerId: deps.pms.providerId,
          status: notified.status,
          detail: notified.detail,
        },
        createdAt: new Date().toISOString(),
      });
    } catch {
      // never fail booking on audit
    }
  }

  return {
    status: notified.status,
    detail: notified.detail,
    providerId: deps.pms.providerId,
  };
}
