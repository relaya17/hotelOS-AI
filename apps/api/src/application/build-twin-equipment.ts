import type {
  EquipmentAssetCategory,
  EquipmentRepository,
  PersistedEquipmentAsset,
  PersistedEquipmentSignal,
  PersistedMaintenancePrediction,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { PM_ERROR_SIGNAL_WINDOW_DAYS } from "./detect-predictive-maintenance.js";

/** Max live equipment nodes returned on the Digital Twin. */
export const TWIN_EQUIPMENT_MAX_ASSETS = 50;

/** Latest sensor readings attached per asset node. */
export const TWIN_EQUIPMENT_MAX_SIGNALS = 3;

/** Top equipment rows in overlay summary (SSE + Admin). */
export const TWIN_EQUIPMENT_SUMMARY_TOP_ITEMS = 5;

/**
 * Equipment categories on the Twin. `boiler` covers water/heating systems
 * (דודים, מערכות חימום, מים חמים) — not guest-room plumbing alone.
 */
export type TwinEquipmentCategory = EquipmentAssetCategory;

export type TwinEquipmentHealth = "critical" | "warning" | "ok";

export type TwinEquipmentSignal = {
  readonly id: string;
  readonly signalType: string;
  readonly valueNum: number | null;
  readonly valueText: string | null;
  readonly recordedAt: string;
};

export type TwinEquipmentOpenPrediction = {
  readonly id: string;
  readonly riskScore: number;
  readonly rationaleHe: string;
  readonly status: string;
};

export type TwinEquipmentNode = {
  readonly assetId: string;
  readonly assetCode: string;
  readonly nameHe: string;
  readonly category: TwinEquipmentCategory;
  readonly locationHe: string;
  readonly health: TwinEquipmentHealth;
  readonly openPrediction?: TwinEquipmentOpenPrediction;
  readonly latestSignals: readonly TwinEquipmentSignal[];
};

export type TwinEquipmentSummaryItem = {
  readonly assetId: string;
  readonly assetCode: string;
  readonly nameHe: string;
  readonly category: TwinEquipmentCategory;
  readonly health: TwinEquipmentHealth;
  readonly riskScore?: number;
};

export type TwinEquipmentSummary = {
  readonly count: number;
  readonly byCategory: Readonly<
    Record<TwinEquipmentCategory, number>
  >;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly topItems: readonly TwinEquipmentSummaryItem[];
};

export type HotelTwinEquipment = {
  readonly generatedAt: string;
  readonly assets: readonly TwinEquipmentNode[];
};

export type BuildTwinEquipmentDeps = {
  readonly equipment: EquipmentRepository;
};

function daysAgoIso(nowIso: string, days: number): string {
  const base = Date.parse(nowIso);
  return new Date(base - days * 86_400_000).toISOString();
}

function emptyByCategory(): Record<TwinEquipmentCategory, number> {
  return { hvac: 0, elevator: 0, boiler: 0, other: 0 };
}

function sortAssetsByCode(
  rows: readonly PersistedEquipmentAsset[],
): readonly PersistedEquipmentAsset[] {
  return [...rows].sort((a, b) => a.code.localeCompare(b.code, "he"));
}

function pickOpenPrediction(
  predictions: readonly PersistedMaintenancePrediction[],
  assetId: string,
): PersistedMaintenancePrediction | null {
  const open = predictions.filter(
    (prediction) =>
      prediction.assetId === assetId &&
      (prediction.status === "open" || prediction.status === "acknowledged"),
  );
  if (open.length === 0) {
    return null;
  }
  return open.sort(
    (a, b) =>
      b.riskScore - a.riskScore || b.createdAt.localeCompare(a.createdAt),
  )[0]!;
}

function mapSignal(signal: PersistedEquipmentSignal): TwinEquipmentSignal {
  return {
    id: signal.id,
    signalType: signal.signalType,
    valueNum: signal.valueNum,
    valueText: signal.valueText,
    recordedAt: signal.recordedAt,
  };
}

export function computeTwinEquipmentHealth(input: {
  readonly nowIso: string;
  readonly openPrediction: PersistedMaintenancePrediction | null;
  readonly signals: readonly PersistedEquipmentSignal[];
}): TwinEquipmentHealth {
  const prediction = input.openPrediction;
  if (
    prediction &&
    (prediction.status === "open" || prediction.status === "acknowledged")
  ) {
    if (prediction.riskScore >= 70) {
      return "critical";
    }
    if (prediction.riskScore >= 40) {
      return "warning";
    }
  }

  const errorSince = daysAgoIso(input.nowIso, PM_ERROR_SIGNAL_WINDOW_DAYS);
  const hasRecentError = input.signals.some(
    (signal) =>
      signal.signalType === "error_code" && signal.recordedAt >= errorSince,
  );
  if (hasRecentError) {
    return "warning";
  }

  return "ok";
}

const HEALTH_RANK: Readonly<Record<TwinEquipmentHealth, number>> = {
  critical: 0,
  warning: 1,
  ok: 2,
};

export function buildTwinEquipmentSummary(
  nodes: readonly TwinEquipmentNode[],
): TwinEquipmentSummary {
  const byCategory = emptyByCategory();
  let criticalCount = 0;
  let warningCount = 0;

  for (const node of nodes) {
    byCategory[node.category] += 1;
    if (node.health === "critical") {
      criticalCount += 1;
    } else if (node.health === "warning") {
      warningCount += 1;
    }
  }

  const topItems = [...nodes]
    .sort((a, b) => {
      const healthDiff = HEALTH_RANK[a.health] - HEALTH_RANK[b.health];
      if (healthDiff !== 0) {
        return healthDiff;
      }
      const riskA = a.openPrediction?.riskScore ?? 0;
      const riskB = b.openPrediction?.riskScore ?? 0;
      return riskB - riskA || a.assetCode.localeCompare(b.assetCode, "he");
    })
    .slice(0, TWIN_EQUIPMENT_SUMMARY_TOP_ITEMS)
    .map(
      (node): TwinEquipmentSummaryItem => ({
        assetId: node.assetId,
        assetCode: node.assetCode,
        nameHe: node.nameHe,
        category: node.category,
        health: node.health,
        ...(node.openPrediction
          ? { riskScore: node.openPrediction.riskScore }
          : {}),
      }),
    );

  return {
    count: nodes.length,
    byCategory,
    criticalCount,
    warningCount,
    topItems,
  };
}

/**
 * Live equipment nodes for the Digital Twin — HVAC, elevators, boiler/water
 * systems with open predictions and latest sensor readings.
 */
export async function buildTwinEquipment(
  deps: BuildTwinEquipmentDeps,
  tenantId: TenantId,
  hotelId: HotelId,
  nowIso: string = new Date().toISOString(),
): Promise<HotelTwinEquipment> {
  const [assets, openPredictions] = await Promise.all([
    deps.equipment.listAssetsByHotel(tenantId, hotelId),
    deps.equipment.listOpenPredictionsByHotel(tenantId, hotelId),
  ]);

  const cappedAssets = sortAssetsByCode(assets).slice(0, TWIN_EQUIPMENT_MAX_ASSETS);
  const nodes: TwinEquipmentNode[] = [];

  for (const asset of cappedAssets) {
    const signals = await deps.equipment.listSignalsByAsset(
      tenantId,
      asset.id,
      TWIN_EQUIPMENT_MAX_SIGNALS,
    );
    const openPrediction = pickOpenPrediction(openPredictions, asset.id);
    const health = computeTwinEquipmentHealth({
      nowIso,
      openPrediction,
      signals,
    });

    nodes.push({
      assetId: asset.id,
      assetCode: asset.code,
      nameHe: asset.nameHe,
      category: asset.category,
      locationHe: asset.locationHe,
      health,
      ...(openPrediction
        ? {
            openPrediction: {
              id: openPrediction.id,
              riskScore: openPrediction.riskScore,
              rationaleHe: openPrediction.rationaleHe,
              status: openPrediction.status,
            },
          }
        : {}),
      latestSignals: signals.map(mapSignal),
    });
  }

  return {
    generatedAt: nowIso,
    assets: nodes,
  };
}
