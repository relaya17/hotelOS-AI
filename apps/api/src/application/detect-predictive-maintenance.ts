import { randomUUID } from "node:crypto";
import type {
  EquipmentAssetCategory,
  EquipmentRepository,
  MaintenanceRepository,
  OpsRepository,
  PersistedEquipmentAsset,
  PersistedEquipmentSignal,
  PersistedMaintenancePrediction,
  PersistedMaintenanceRequest,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";

/** Window for counting repeated maintenance requests. */
export const PM_MAINTENANCE_WINDOW_DAYS = 30;

/** Minimum repeated requests in window to flag high risk. */
export const PM_MAINTENANCE_REPEAT_MIN = 2;

/** Recent error-code signals within this window trigger alerts. */
export const PM_ERROR_SIGNAL_WINDOW_DAYS = 7;

/** Risk score at or above this opens a maintenance department_task. */
export const PM_TASK_RISK_THRESHOLD = 70;

export const PM_RUNTIME_THRESHOLDS: Readonly<
  Record<EquipmentAssetCategory, number>
> = {
  hvac: 8760,
  elevator: 50_000,
  boiler: 6000,
  other: 12_000,
};

export const PM_ELEVATOR_VIBRATION_THRESHOLD = 5.0;
export const PM_BOILER_TEMP_THRESHOLD_C = 95;

/** Stable actor for scheduled scans (not a login user). */
export const PM_SCAN_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000pm",
);

export type PredictiveMaintenanceDraft = {
  readonly fingerprint: string;
  readonly assetId: string;
  readonly riskScore: number;
  readonly rationaleHe: string;
  readonly recommendedActionHe: string;
};

export type PredictiveMaintenanceAssetSnapshot = {
  readonly asset: PersistedEquipmentAsset;
  readonly signals: readonly PersistedEquipmentSignal[];
};

export function pmFingerprintMarker(fingerprint: string): string {
  return `[pm:${fingerprint}]`;
}

function daysAgoIso(nowIso: string, days: number): string {
  const base = Date.parse(nowIso);
  return new Date(base - days * 86_400_000).toISOString();
}

function assetCategoryKeywords(
  category: EquipmentAssetCategory,
): readonly string[] {
  switch (category) {
    case "hvac":
      return ["hvac", "מיזוג", "אוויר", "מעבה", "צ'ילר", "chiller"];
    case "elevator":
      return ["מעלית", "elevator", "lift"];
    case "boiler":
      return ["דוד", "boiler", "חימום", "קיטור"];
    case "other":
      return [];
  }
}

function maintenanceMatchesAsset(
  request: PersistedMaintenanceRequest,
  asset: PersistedEquipmentAsset,
): boolean {
  const haystack =
    `${request.title} ${request.description} ${request.category}`.toLowerCase();
  if (haystack.includes(asset.code.toLowerCase())) {
    return true;
  }
  if (haystack.includes(asset.locationHe.toLowerCase())) {
    return true;
  }
  return assetCategoryKeywords(asset.category).some((keyword) =>
    haystack.includes(keyword.toLowerCase()),
  );
}

function latestSignal(
  signals: readonly PersistedEquipmentSignal[],
  signalType: PersistedEquipmentSignal["signalType"],
): PersistedEquipmentSignal | null {
  const filtered = signals.filter((signal) => signal.signalType === signalType);
  if (filtered.length === 0) {
    return null;
  }
  return filtered.reduce((latest, signal) =>
    Date.parse(signal.recordedAt) > Date.parse(latest.recordedAt)
      ? signal
      : latest,
  );
}

function recentSignals(
  signals: readonly PersistedEquipmentSignal[],
  signalType: PersistedEquipmentSignal["signalType"],
  sinceIso: string,
): readonly PersistedEquipmentSignal[] {
  const since = Date.parse(sinceIso);
  return signals.filter(
    (signal) =>
      signal.signalType === signalType && Date.parse(signal.recordedAt) >= since,
  );
}

/**
 * Deterministic rules — no LLM, no live IoT required.
 * Uses maintenance history + optional sensor webhook signals.
 */
export function detectPredictiveMaintenance(input: {
  readonly nowIso: string;
  readonly assets: readonly PredictiveMaintenanceAssetSnapshot[];
  readonly maintenanceRequests: readonly PersistedMaintenanceRequest[];
}): readonly PredictiveMaintenanceDraft[] {
  const maintenanceSince = daysAgoIso(
    input.nowIso,
    PM_MAINTENANCE_WINDOW_DAYS,
  );
  const errorSince = daysAgoIso(input.nowIso, PM_ERROR_SIGNAL_WINDOW_DAYS);
  const drafts: PredictiveMaintenanceDraft[] = [];

  for (const snapshot of input.assets) {
    const { asset, signals } = snapshot;
    const relatedMaintenance = input.maintenanceRequests.filter(
      (request) =>
        request.createdAt >= maintenanceSince &&
        maintenanceMatchesAsset(request, asset),
    );

    if (relatedMaintenance.length >= PM_MAINTENANCE_REPEAT_MIN) {
      drafts.push({
        fingerprint: `repeat_maintenance:${asset.id}`,
        assetId: asset.id,
        riskScore: Math.min(
          100,
          60 + relatedMaintenance.length * 10,
        ),
        rationaleHe: `${relatedMaintenance.length} קריאות תחזוקה ב-${PM_MAINTENANCE_WINDOW_DAYS} יום לנכס ${asset.nameHe} (${asset.code}).`,
        recommendedActionHe:
          "תזמון בדיקה מונעת וסקירת ספק — דפוס תקלות חוזר.",
      });
    }

    const recentErrors = recentSignals(signals, "error_code", errorSince);
    if (recentErrors.length > 0) {
      const codes = recentErrors
        .map((signal) => signal.valueText ?? String(signal.valueNum ?? "?"))
        .join(", ");
      drafts.push({
        fingerprint: `error_code:${asset.id}`,
        assetId: asset.id,
        riskScore: Math.min(100, 72 + recentErrors.length * 8),
        rationaleHe: `קודי שגיאה מהחיישן: ${codes} (${asset.nameHe}).`,
        recommendedActionHe: "אבחון טכני דחוף לפי קוד השגיאה.",
      });
    }

    const runtimeSignal = latestSignal(signals, "runtime_hours");
    const runtimeThreshold = PM_RUNTIME_THRESHOLDS[asset.category];
    if (
      runtimeSignal?.valueNum !== null &&
      runtimeSignal?.valueNum !== undefined &&
      runtimeSignal.valueNum >= runtimeThreshold
    ) {
      drafts.push({
        fingerprint: `runtime_hours:${asset.id}`,
        assetId: asset.id,
        riskScore: Math.min(
          100,
          65 +
            Math.round(
              ((runtimeSignal.valueNum - runtimeThreshold) / runtimeThreshold) *
                30,
            ),
        ),
        rationaleHe: `שעות פעולה ${runtimeSignal.valueNum} (סף ${runtimeThreshold}) — ${asset.nameHe}.`,
        recommendedActionHe: "תכנון תחזוקה מונעת לפי מונה שעות.",
      });
    }

    if (asset.category === "elevator") {
      const vibration = latestSignal(signals, "vibration");
      if (
        vibration?.valueNum !== null &&
        vibration?.valueNum !== undefined &&
        vibration.valueNum >= PM_ELEVATOR_VIBRATION_THRESHOLD
      ) {
        drafts.push({
          fingerprint: `elevator_vibration:${asset.id}`,
          assetId: asset.id,
          riskScore: 78,
          rationaleHe: `רמת רעידות ${vibration.valueNum} (סף ${PM_ELEVATOR_VIBRATION_THRESHOLD}) במעלית ${asset.nameHe}.`,
          recommendedActionHe: "בדיקת מעלית + בלמים/כבלים לפני שימוש אינטנסיבי.",
        });
      }
    }

    if (asset.category === "boiler") {
      const temp = latestSignal(signals, "temp_c");
      if (
        temp?.valueNum !== null &&
        temp?.valueNum !== undefined &&
        temp.valueNum >= PM_BOILER_TEMP_THRESHOLD_C
      ) {
        drafts.push({
          fingerprint: `boiler_temp:${asset.id}`,
          assetId: asset.id,
          riskScore: 80,
          rationaleHe: `טמפרטורה ${temp.valueNum}°C (סף ${PM_BOILER_TEMP_THRESHOLD_C}°C) בדוד ${asset.nameHe}.`,
          recommendedActionHe: "בדיקת בטיחות דוד/לחץ — סיכון תקלה.",
        });
      }
    }
  }

  const byFingerprint = new Map<string, PredictiveMaintenanceDraft>();
  for (const draft of drafts) {
    const existing = byFingerprint.get(draft.fingerprint);
    if (!existing || draft.riskScore > existing.riskScore) {
      byFingerprint.set(draft.fingerprint, draft);
    }
  }

  return [...byFingerprint.values()].sort(
    (a, b) => b.riskScore - a.riskScore,
  );
}

export type RunPredictiveMaintenanceScanDeps = {
  readonly equipment: EquipmentRepository;
  readonly maintenance: MaintenanceRepository;
  readonly ops: OpsRepository;
};

export type PredictiveMaintenanceScanResult = {
  readonly hotelId: string;
  readonly predictionCount: number;
  readonly tasksCreated: number;
  readonly predictions: readonly PersistedMaintenancePrediction[];
};

export async function runPredictiveMaintenanceScan(
  deps: RunPredictiveMaintenanceScanDeps,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly actorUserId?: UserId;
    readonly createTasks?: boolean;
    readonly now?: string;
  },
): Promise<PredictiveMaintenanceScanResult> {
  const actorUserId = input.actorUserId ?? PM_SCAN_ACTOR_USER_ID;
  const createTasks = input.createTasks ?? true;
  const now = input.now ?? new Date().toISOString();

  const [assets, maintenanceRequests, openPredictions] = await Promise.all([
    deps.equipment.listAssetsByHotel(input.tenantId, input.hotelId),
    deps.maintenance.listByHotel(input.tenantId, input.hotelId),
    deps.equipment.listOpenPredictionsByHotel(input.tenantId, input.hotelId),
  ]);

  const snapshots = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      signals: await deps.equipment.listSignalsByAsset(
        input.tenantId,
        asset.id,
        100,
      ),
    })),
  );

  const drafts = detectPredictiveMaintenance({
    nowIso: now,
    assets: snapshots,
    maintenanceRequests,
  });

  const persisted: PersistedMaintenancePrediction[] = [];
  let tasksCreated = 0;

  for (const draft of drafts) {
    const marker = pmFingerprintMarker(draft.fingerprint);
    const existing = openPredictions.find((prediction) =>
      prediction.rationaleHe.includes(marker),
    );
    if (existing) {
      persisted.push(existing);
      continue;
    }

    const prediction = await deps.equipment.createPrediction({
      id: randomUUID(),
      tenantId: input.tenantId,
      hotelId: input.hotelId,
      assetId: draft.assetId,
      riskScore: draft.riskScore,
      rationaleHe: `${marker}\n${draft.rationaleHe}`,
      recommendedActionHe: draft.recommendedActionHe,
      createdAt: now,
    });
    persisted.push(prediction);

    if (createTasks && draft.riskScore >= PM_TASK_RISK_THRESHOLD) {
      const taskCreated = await ensurePredictiveMaintenanceTask(deps.ops, {
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        actorUserId,
        prediction,
        asset: assets.find((item) => item.id === draft.assetId),
        now,
      });
      if (taskCreated) {
        tasksCreated += 1;
        const linked = await deps.equipment.linkPredictionTask(
          input.tenantId,
          prediction.id,
          taskCreated,
        );
        if (linked) {
          persisted[persisted.length - 1] = linked;
        }
      }
    }
  }

  return {
    hotelId: input.hotelId,
    predictionCount: persisted.length,
    tasksCreated,
    predictions: persisted,
  };
}

async function ensurePredictiveMaintenanceTask(
  ops: OpsRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly actorUserId: UserId;
    readonly prediction: PersistedMaintenancePrediction;
    readonly asset: PersistedEquipmentAsset | undefined;
    readonly now: string;
  },
): Promise<string | null> {
  await ops.ensureStandardDepartments(
    input.tenantId,
    input.hotelId,
    input.now,
  );
  const dept = await ops.findDepartmentByCode(
    input.tenantId,
    input.hotelId,
    "maintenance",
  );
  if (!dept) {
    return null;
  }

  const marker = pmFingerprintMarker(`task:${input.prediction.id}`);
  const existing = await ops.listTasksByDepartment(
    input.tenantId,
    input.hotelId,
    dept.id,
  );
  const alreadyOpen = existing.some(
    (task) =>
      task.description.includes(marker) &&
      task.status !== "done" &&
      task.status !== "cancelled",
  );
  if (alreadyOpen) {
    return null;
  }

  const assetLabel = input.asset?.nameHe ?? input.prediction.assetId;
  const task = await ops.createTask({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    departmentId: dept.id,
    taskType: "predictive_maintenance",
    title: `תחזוקה חזויה — ${assetLabel} (${input.prediction.riskScore}/100)`,
    description: `${marker}\n${input.prediction.rationaleHe}\n\nפעולה מומלצת: ${input.prediction.recommendedActionHe}`,
    priority: "high",
    createdByUserId: input.actorUserId,
    createdAt: input.now,
  });
  return task.id;
}

/** Demo tenant scan helper for cron/API. */
export async function runPredictiveMaintenanceScanDemo(
  deps: RunPredictiveMaintenanceScanDeps,
  hotelId: HotelId,
): Promise<PredictiveMaintenanceScanResult | null> {
  return runPredictiveMaintenanceScan(deps, {
    tenantId: Ids.tenant(DEMO_TENANT_ID),
    hotelId,
  });
}
