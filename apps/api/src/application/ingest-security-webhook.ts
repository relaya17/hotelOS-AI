import type {
  AuditRepository,
  HotelRepository,
  OpsRepository,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  mapSecurityWebhook,
  type SecurityWebhookProvider,
} from "./map-security-webhook.js";

/** Stable actor for VMS webhook ingest (not a login session). */
export const VMS_INGEST_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000v1",
);

export type IngestSecurityWebhookDeps = {
  readonly hotels: HotelRepository;
  readonly ops: OpsRepository;
  readonly audit: AuditRepository;
};

export type IngestSecurityWebhookResult =
  | {
      readonly ok: true;
      readonly taskId: string;
      readonly hotelId: string;
      readonly source: string;
    }
  | {
      readonly ok: false;
      readonly code: "HOTEL_NOT_FOUND" | "SECURITY_DEPT_MISSING";
      readonly message: string;
    };

/**
 * Public VMS webhook path — no JWT. Caller must authorize with shared secret.
 * Maps vendor payload → security department task (stage ו׳ pilot).
 */
export async function ingestSecurityWebhook(
  deps: IngestSecurityWebhookDeps,
  input: {
    readonly provider: SecurityWebhookProvider;
    readonly body: unknown;
    readonly tenantId?: TenantId;
    readonly actorUserId?: UserId;
  },
): Promise<IngestSecurityWebhookResult> {
  const event = mapSecurityWebhook(input.provider, input.body);
  const tenantId = input.tenantId ?? Ids.tenant(DEMO_TENANT_ID);
  const actorUserId = input.actorUserId ?? VMS_INGEST_ACTOR_USER_ID;
  const hotelId = Ids.hotel(event.hotelId);

  const hotel = await deps.hotels.findById(hotelId);
  if (!hotel || hotel.tenantId !== tenantId) {
    return {
      ok: false,
      code: "HOTEL_NOT_FOUND",
      message: "Hotel id from VMS webhook is not in this tenant",
    };
  }

  const now = new Date().toISOString();
  await deps.ops.ensureStandardDepartments(tenantId, hotelId, now);
  const dept = await deps.ops.findDepartmentByCode(
    tenantId,
    hotelId,
    "security",
  );
  if (!dept) {
    return {
      ok: false,
      code: "SECURITY_DEPT_MISSING",
      message: "Security department not available",
    };
  }

  const external =
    event.externalEventId !== undefined
      ? ` event=${event.externalEventId}`
      : "";
  const task = await deps.ops.createTask({
    id: randomUUID(),
    tenantId,
    hotelId: hotelId as HotelId,
    departmentId: dept.id,
    taskType: "security_event",
    title: event.title,
    description: `[${event.source}] ${event.description}${external}`,
    priority: event.priority,
    createdByUserId: actorUserId,
    createdAt: now,
  });

  await deps.audit.append({
    id: randomUUID(),
    tenantId,
    actorUserId,
    action: "ops.security_event.create",
    resourceType: "department_task",
    resourceId: task.id,
    metadata: {
      source: event.source,
      hotelId: event.hotelId,
      provider: input.provider,
      publicIngest: true,
      ...(event.externalEventId !== undefined
        ? { externalEventId: event.externalEventId }
        : {}),
    },
    createdAt: now,
  });

  return {
    ok: true,
    taskId: task.id,
    hotelId: event.hotelId,
    source: event.source,
  };
}
