import type {
  HotelRepository,
  MaintenanceRepository,
  OpsRepository,
  ProcurementRepository,
  TurboRepository,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  detectOpsAnomalies,
  type OpsAnomaly,
} from "./detect-ops-anomalies.js";

/** Stable actor for scheduled anomaly scans (not a login user). */
const CRON_ANOMALY_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000a1",
);

export type RunAnomalyScanDeps = {
  readonly hotels: HotelRepository;
  readonly maintenance: MaintenanceRepository;
  readonly procurement: ProcurementRepository;
  readonly turbo: TurboRepository;
  readonly ops: OpsRepository;
};

export type AnomalyScanResult = {
  readonly tenantId: string;
  readonly anomalyCount: number;
  readonly tasksCreated: number;
  readonly anomalies: readonly OpsAnomaly[];
};

/**
 * Scan demo tenant for threshold anomalies and open IT tasks (deduped).
 * Does not move money — Suggest path only via department_tasks.
 */
export async function runAnomalyScan(
  deps: RunAnomalyScanDeps,
  options?: {
    readonly tenantId?: TenantId;
    readonly actorUserId?: UserId;
    readonly createTasks?: boolean;
  },
): Promise<AnomalyScanResult | null> {
  const tenantId = options?.tenantId ?? Ids.tenant(DEMO_TENANT_ID);
  const actorUserId = options?.actorUserId ?? CRON_ANOMALY_ACTOR_USER_ID;
  const createTasks = options?.createTasks ?? true;
  const hotelRows = await deps.hotels.listByTenant(tenantId);
  if (hotelRows.length === 0) return null;

  const now = new Date().toISOString();
  const snapshots = await Promise.all(
    hotelRows.map(async (hotel) => {
      const hotelId = hotel.id;
      const [inventory, maintenance, purchaseOrders] = await Promise.all([
        deps.procurement.listInventory(tenantId, hotelId),
        deps.maintenance.listByHotel(tenantId, hotelId),
        deps.procurement.listPurchaseOrders(tenantId, hotelId),
      ]);
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        inventory,
        maintenance,
        purchaseOrders,
      };
    }),
  );

  const journal = await deps.turbo.listJournal(tenantId);
  const anomalies = detectOpsAnomalies({
    nowIso: now,
    hotels: snapshots,
    journal,
  });

  let tasksCreated = 0;
  if (createTasks) {
    for (const anomaly of anomalies) {
      const hotelId =
        anomaly.hotelId !== null
          ? Ids.hotel(anomaly.hotelId)
          : hotelRows[0]?.id;
      if (hotelId === undefined) continue;

      const created = await ensureAnomalyTask(deps.ops, {
        tenantId,
        hotelId,
        actorUserId,
        anomaly,
        now,
      });
      if (created) tasksCreated += 1;
    }
  }

  return {
    tenantId,
    anomalyCount: anomalies.length,
    tasksCreated,
    anomalies,
  };
}

async function ensureAnomalyTask(
  ops: OpsRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly actorUserId: UserId;
    readonly anomaly: OpsAnomaly;
    readonly now: string;
  },
): Promise<boolean> {
  await ops.ensureStandardDepartments(
    input.tenantId,
    input.hotelId,
    input.now,
  );
  const deptCode =
    input.anomaly.type === "large_journal_entry" ||
    input.anomaly.type === "large_purchase_order"
      ? "finance"
      : input.anomaly.type === "stale_urgent_maintenance" ||
          input.anomaly.type === "same_day_maintenance_close"
        ? "maintenance"
        : "it";
  const dept =
    (await ops.findDepartmentByCode(
      input.tenantId,
      input.hotelId,
      deptCode,
    )) ??
    (await ops.findDepartmentByCode(input.tenantId, input.hotelId, "it"));
  if (!dept) return false;

  const existing = await ops.listTasksByDepartment(
    input.tenantId,
    input.hotelId,
    dept.id,
  );
  const marker = `[anomaly:${input.anomaly.fingerprint}]`;
  const alreadyOpen = existing.some(
    (task) =>
      task.description.includes(marker) &&
      task.status !== "done" &&
      task.status !== "cancelled",
  );
  if (alreadyOpen) return false;

  await ops.createTask({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    departmentId: dept.id,
    taskType: "anomaly_alert",
    title: input.anomaly.titleHe.slice(0, 200),
    description: `${marker}\n${input.anomaly.evidenceHe}`,
    priority: input.anomaly.severity,
    createdByUserId: input.actorUserId,
    createdAt: input.now,
  });
  return true;
}

/** Load anomalies for an authenticated API read (no task side effects). */
export async function listOpsAnomalies(
  deps: Omit<RunAnomalyScanDeps, "ops"> & { readonly ops?: OpsRepository },
  input: {
    readonly tenantId: TenantId;
    readonly hotelIds: readonly HotelId[];
  },
): Promise<readonly OpsAnomaly[]> {
  const hotelRows = await deps.hotels.listByTenant(input.tenantId);
  const allowed = new Set(input.hotelIds.map((id) => id as string));
  const scoped = hotelRows.filter((hotel) => allowed.has(hotel.id));
  if (scoped.length === 0) return [];

  const snapshots = await Promise.all(
    scoped.map(async (hotel) => {
      const hotelId = hotel.id;
      const [inventory, maintenance, purchaseOrders] = await Promise.all([
        deps.procurement.listInventory(input.tenantId, hotelId),
        deps.maintenance.listByHotel(input.tenantId, hotelId),
        deps.procurement.listPurchaseOrders(input.tenantId, hotelId),
      ]);
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        inventory,
        maintenance,
        purchaseOrders,
      };
    }),
  );

  const journal = await deps.turbo.listJournal(input.tenantId);
  return detectOpsAnomalies({ hotels: snapshots, journal });
}
