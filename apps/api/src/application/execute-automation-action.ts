import { randomUUID } from "node:crypto";
import type { PmsConnector } from "@hotelos/connectors";
import type {
  AuditRepository,
  HotelRepository,
  OpsRepository,
  TurboRepository,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import { syncBookingInventory } from "./sync-booking-inventory.js";

export type ExecuteAutomationActionInput = {
  readonly tenantId: TenantId;
  readonly hotelId?: HotelId;
  readonly actionKey: string;
  readonly triggerKey: string;
  readonly detail: string;
  readonly bookingId?: string;
  readonly guestName?: string;
  readonly actorUserId?: string;
  readonly checkInDate?: string;
  readonly checkOutDate?: string;
  readonly roomType?: string;
  readonly roomNumber?: string | null;
};

export type ExecuteAutomationActionResult = {
  readonly effect: string;
  readonly taskId?: string;
};

async function resolveHotelId(
  deps: {
    readonly hotels?: HotelRepository;
  },
  tenantId: TenantId,
  hotelId?: HotelId,
): Promise<HotelId | undefined> {
  if (hotelId) return hotelId;
  if (!deps.hotels) return undefined;
  const hotels = await deps.hotels.listByTenant(tenantId);
  return hotels[0] ? Ids.hotel(hotels[0].id) : undefined;
}

async function createDeptTask(
  ops: OpsRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly departmentCode: string;
    readonly taskType: string;
    readonly title: string;
    readonly description: string;
    readonly priority: "low" | "medium" | "high" | "urgent";
    readonly actorUserId?: string;
  },
): Promise<string | undefined> {
  const now = new Date().toISOString();
  await ops.ensureStandardDepartments(input.tenantId, input.hotelId, now);
  const dept = await ops.findDepartmentByCode(
    input.tenantId,
    input.hotelId,
    input.departmentCode,
  );
  if (!dept) return undefined;
  const task = await ops.createTask({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    departmentId: dept.id,
    taskType: input.taskType,
    title: input.title,
    description: input.description,
    priority: input.priority,
    ...(input.actorUserId !== undefined
      ? { createdByUserId: input.actorUserId }
      : {}),
    createdAt: now,
  });
  return task.id;
}

/**
 * Apply real side-effects for a Turbo actionKey after a run row is recorded.
 * Soft ops only — money stays on Suggest→Approve→Act.
 */
export async function executeAutomationAction(
  deps: {
    readonly turbo: TurboRepository;
    readonly ops?: OpsRepository;
    readonly hotels?: HotelRepository;
    readonly pms?: PmsConnector;
    readonly audit?: AuditRepository;
  },
  input: ExecuteAutomationActionInput,
): Promise<ExecuteAutomationActionResult> {
  const hotelId = await resolveHotelId(deps, input.tenantId, input.hotelId);

  switch (input.actionKey) {
    case "sync.pms_inventory": {
      if (!hotelId || !input.bookingId || !input.checkInDate || !input.checkOutDate) {
        return { effect: "logged_only" };
      }
      const synced = await syncBookingInventory(
        {
          ...(deps.pms ? { pms: deps.pms } : {}),
          ...(deps.audit ? { audit: deps.audit } : {}),
        },
        {
          tenantId: input.tenantId,
          hotelId,
          bookingId: input.bookingId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          ...(input.roomType !== undefined ? { roomType: input.roomType } : {}),
          ...(input.roomNumber !== undefined
            ? { roomNumber: input.roomNumber }
            : {}),
          ...(input.guestName !== undefined
            ? { guestName: input.guestName }
            : {}),
        },
      );
      return {
        effect:
          synced.status === "accepted"
            ? "pms_inventory_synced"
            : "pms_inventory_skipped",
      };
    }
    case "notify.reception": {
      if (!deps.ops || !hotelId) {
        return { effect: "logged_only" };
      }
      const guest = input.guestName ?? "אורח";
      const bookingRef = input.bookingId
        ? `הזמנה ${input.bookingId.slice(0, 8)}`
        : input.detail;
      const taskId = await createDeptTask(deps.ops, {
        tenantId: input.tenantId,
        hotelId,
        departmentCode: "front_office",
        taskType: "arrival_prep",
        title: `הכנה להגעה · ${guest}`,
        description: `${bookingRef} · Turbo ${input.triggerKey}`,
        priority: "high",
        ...(input.actorUserId !== undefined
          ? { actorUserId: input.actorUserId }
          : {}),
      });
      return {
        effect: taskId ? "reception_task_created" : "department_missing",
        ...(taskId !== undefined ? { taskId } : {}),
      };
    }
    case "notify.housekeeping": {
      if (!deps.ops || !hotelId) {
        return { effect: "logged_only" };
      }
      const taskId = await createDeptTask(deps.ops, {
        tenantId: input.tenantId,
        hotelId,
        departmentCode: "housekeeping",
        taskType: "dirty_rooms_alert",
        title: "התראת משק בית · חדרים לניקוי",
        description: input.detail,
        priority: "urgent",
        ...(input.actorUserId !== undefined
          ? { actorUserId: input.actorUserId }
          : {}),
      });
      return {
        effect: taskId ? "housekeeping_task_created" : "department_missing",
        ...(taskId !== undefined ? { taskId } : {}),
      };
    }
    case "i18n.translate.deliver":
      return { effect: "chat_translate_already_applied" };
    case "agent.share.cfo":
      return { effect: "finance_brief_hint" };
    case "agent.route.action":
      return { effect: "voice_routed" };
    case "ledger.sync.internal_or_external":
      return { effect: "accounting_sync_queued" };
    default:
      return { effect: "logged_only" };
  }
}
