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
  mapSentryWebhook,
  type HotelOsErrorEvent,
} from "./map-sentry-webhook.js";

/** Stable actor for Sentry webhook ingest (not a login session). */
export const SENTRY_INGEST_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000s1",
);

export type IngestSentryWebhookDeps = {
  readonly hotels: HotelRepository;
  readonly ops: OpsRepository;
  readonly audit: AuditRepository;
};

export type IngestSentryWebhookResult =
  | {
      readonly ok: true;
      readonly skipped: true;
      readonly reason: string;
    }
  | {
      readonly ok: true;
      readonly skipped: false;
      readonly taskId: string;
      readonly hotelId: string;
      readonly source: string;
    }
  | {
      readonly ok: false;
      readonly code: "HOTEL_NOT_FOUND" | "IT_DEPT_MISSING";
      readonly message: string;
    };

/**
 * Public Sentry webhook path — no JWT. Caller must authorize with shared secret.
 * Maps vendor payload → IT department task (stage ב׳).
 */
export async function ingestSentryWebhook(
  deps: IngestSentryWebhookDeps,
  input: {
    readonly body: unknown;
    readonly defaultHotelId?: string;
    readonly tenantId?: TenantId;
    readonly actorUserId?: UserId;
  },
): Promise<IngestSentryWebhookResult> {
  const mapped = mapSentryWebhook(input.body, {
    ...(input.defaultHotelId !== undefined
      ? { defaultHotelId: input.defaultHotelId }
      : {}),
  });
  if (mapped === null) {
    return {
      ok: true,
      skipped: true,
      reason: "Sentry webhook action does not require an IT task",
    };
  }

  return createItTaskFromErrorEvent(deps, mapped, {
    tenantId: input.tenantId ?? Ids.tenant(DEMO_TENANT_ID),
    actorUserId: input.actorUserId ?? SENTRY_INGEST_ACTOR_USER_ID,
  });
}

async function createItTaskFromErrorEvent(
  deps: IngestSentryWebhookDeps,
  event: HotelOsErrorEvent,
  ctx: { readonly tenantId: TenantId; readonly actorUserId: UserId },
): Promise<IngestSentryWebhookResult> {
  const hotelId = Ids.hotel(event.hotelId);
  const hotel = await deps.hotels.findById(hotelId);
  if (!hotel || hotel.tenantId !== ctx.tenantId) {
    return {
      ok: false,
      code: "HOTEL_NOT_FOUND",
      message: "Hotel id from Sentry webhook is not in this tenant",
    };
  }

  const now = new Date().toISOString();
  await deps.ops.ensureStandardDepartments(ctx.tenantId, hotelId, now);
  const dept = await deps.ops.findDepartmentByCode(
    ctx.tenantId,
    hotelId,
    "it",
  );
  if (!dept) {
    return {
      ok: false,
      code: "IT_DEPT_MISSING",
      message: "IT department not available",
    };
  }

  const appTag = event.app ? `${event.app}/` : "";
  const external =
    event.externalEventId !== undefined
      ? ` event=${event.externalEventId}`
      : "";
  const task = await deps.ops.createTask({
    id: randomUUID(),
    tenantId: ctx.tenantId,
    hotelId: hotelId,
    departmentId: dept.id,
    taskType: "error_event",
    title: event.title,
    description: `[${appTag}${event.source}] ${event.description}${external}`,
    priority: event.priority,
    createdByUserId: ctx.actorUserId,
    createdAt: now,
  });

  await deps.audit.append({
    id: randomUUID(),
    tenantId: ctx.tenantId,
    actorUserId: ctx.actorUserId,
    action: "ops.error_event.create",
    resourceType: "department_task",
    resourceId: task.id,
    metadata: {
      source: event.source,
      hotelId: event.hotelId,
      publicIngest: true,
      provider: "sentry",
      ...(event.app !== undefined ? { app: event.app } : {}),
      ...(event.externalEventId !== undefined
        ? { externalEventId: event.externalEventId }
        : {}),
    },
    createdAt: now,
  });

  return {
    ok: true,
    skipped: false,
    taskId: task.id,
    hotelId: event.hotelId,
    source: event.source,
  };
}
