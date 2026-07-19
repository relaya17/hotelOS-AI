import type {
  AuditWrite,
  HotelRepository,
  OpsRepository,
} from "@hotelos/database";
import { randomUUID } from "node:crypto";

const SENSITIVE_ACTIONS = new Set([
  "autonomy.act",
  "ai.approval.approved",
  "payment.intent.created",
  "hr.document.approved",
  "hr.document.rejected",
]);

const NOISE_ACTIONS = new Set([
  "ops.error_event.create",
  "ops.security_event.create",
  "ops.audit_alert.create",
]);

export function isSensitiveAuditEvent(event: AuditWrite): boolean {
  if (NOISE_ACTIONS.has(event.action)) return false;
  if (event.action.startsWith("audit_alert.")) return false;
  if (!SENSITIVE_ACTIONS.has(event.action)) return false;
  if (
    event.action.startsWith("hr.document.") &&
    event.metadata["sensitiveHr"] !== true
  ) {
    return false;
  }
  return true;
}

/**
 * After a sensitive audit write, open a deduped IT department task (stage א' alerting).
 * Never throws to the caller — failures are swallowed by the wrapper.
 */
export async function alertOnSensitiveAudit(
  deps: {
    readonly ops: OpsRepository;
    readonly hotels: HotelRepository;
  },
  event: AuditWrite,
): Promise<boolean> {
  if (!isSensitiveAuditEvent(event)) return false;

  let hotelId = event.hotelId;
  if (hotelId === undefined) {
    const rows = await deps.hotels.listByTenant(event.tenantId);
    const first = rows[0];
    if (!first) return false;
    hotelId = first.id;
  }

  const now = event.createdAt;
  await deps.ops.ensureStandardDepartments(event.tenantId, hotelId, now);
  const dept = await deps.ops.findDepartmentByCode(
    event.tenantId,
    hotelId,
    "it",
  );
  if (!dept) return false;

  const fingerprint = `${event.action}:${event.resourceId ?? event.id}`;
  const marker = `[audit-alert:${fingerprint}]`;
  const existing = await deps.ops.listTasksByDepartment(
    event.tenantId,
    hotelId,
    dept.id,
  );
  const alreadyOpen = existing.some(
    (task) =>
      task.description.includes(marker) &&
      task.status !== "done" &&
      task.status !== "cancelled",
  );
  if (alreadyOpen) return false;

  const actor =
    event.actorUserId !== undefined ? ` actor=${event.actorUserId}` : "";
  await deps.ops.createTask({
    id: randomUUID(),
    tenantId: event.tenantId,
    hotelId,
    departmentId: dept.id,
    taskType: "audit_alert",
    title: `Audit רגיש: ${event.action}`.slice(0, 200),
    description: `${marker}\n${event.resourceType}${
      event.resourceId !== undefined ? `/${event.resourceId}` : ""
    }${actor}`,
    priority: event.action === "autonomy.act" ? "urgent" : "high",
    ...(event.actorUserId !== undefined
      ? { createdByUserId: event.actorUserId }
      : {}),
    createdAt: now,
  });
  return true;
}
