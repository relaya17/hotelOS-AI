import type {
  EnergyRepository,
  EquipmentRepository,
  HotelRepository,
  MaintenanceRepository,
  OpsRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { buildIncidentCenter } from "./build-incident-center.js";
import {
  buildTwinEquipment,
  buildTwinEquipmentSummary,
  type TwinEquipmentSummary,
} from "./build-twin-equipment.js";

export const TWIN_OVERLAY_TOP_ITEMS = 5;

export type TwinOverlayItem = {
  readonly id: string;
  readonly title: string;
  readonly severity?: string;
  readonly department?: string;
  readonly riskScore?: number;
  readonly estimatedSavingPct?: number;
  readonly status?: string;
  readonly assetId?: string;
  readonly assetCode?: string;
};

export type TwinOverlaySummary = {
  readonly count: number;
  readonly topItems: readonly TwinOverlayItem[];
};

export type HotelTwinOverlays = {
  readonly generatedAt: string;
  readonly openIncidents: TwinOverlaySummary;
  readonly predictiveAlerts: TwinOverlaySummary;
  readonly energyHints: TwinOverlaySummary;
  readonly equipmentSummary: TwinEquipmentSummary;
};

export type BuildTwinOverlaysDeps = {
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly hotels: HotelRepository;
  readonly equipment: EquipmentRepository;
  readonly energy: EnergyRepository;
};

function topItems<T>(
  items: readonly T[],
  limit: number,
  mapItem: (item: T) => TwinOverlayItem,
): TwinOverlaySummary {
  return {
    count: items.length,
    topItems: items.slice(0, limit).map(mapItem),
  };
}

/**
 * Read-only operational overlays for the Digital Twin — incidents,
 * predictive maintenance alerts, and pending energy suggestions.
 */
export async function buildTwinOverlays(
  deps: BuildTwinOverlaysDeps,
  tenantId: TenantId,
  hotelId: HotelId,
): Promise<HotelTwinOverlays> {
  const [incidentCenter, predictions, energySuggestions, twinEquipment] =
    await Promise.all([
      buildIncidentCenter(
        {
          ops: deps.ops,
          maintenance: deps.maintenance,
          hotels: deps.hotels,
        },
        tenantId,
        [hotelId],
      ),
      deps.equipment.listOpenPredictionsByHotel(tenantId, hotelId),
      deps.energy.listSuggestionsByHotel(tenantId, hotelId, "suggested"),
      buildTwinEquipment({ equipment: deps.equipment }, tenantId, hotelId),
    ]);

  const assetCodeById = new Map(
    twinEquipment.assets.map((asset) => [asset.assetId, asset.assetCode]),
  );

  const sortedPredictions = [...predictions].sort(
    (a, b) =>
      b.riskScore - a.riskScore ||
      b.createdAt.localeCompare(a.createdAt),
  );

  const sortedEnergy = [...energySuggestions].sort(
    (a, b) =>
      b.estimatedSavingPct - a.estimatedSavingPct ||
      b.createdAt.localeCompare(a.createdAt),
  );

  return {
    generatedAt: new Date().toISOString(),
    openIncidents: topItems(
      incidentCenter.incidents,
      TWIN_OVERLAY_TOP_ITEMS,
      (incident) => ({
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        department: incident.department,
        status: incident.status,
      }),
    ),
    predictiveAlerts: topItems(
      sortedPredictions,
      TWIN_OVERLAY_TOP_ITEMS,
      (prediction) => ({
        id: prediction.id,
        title: prediction.rationaleHe,
        riskScore: prediction.riskScore,
        status: prediction.status,
        assetId: prediction.assetId,
        ...(assetCodeById.has(prediction.assetId)
          ? { assetCode: assetCodeById.get(prediction.assetId)! }
          : {}),
      }),
    ),
    energyHints: topItems(
      sortedEnergy,
      TWIN_OVERLAY_TOP_ITEMS,
      (suggestion) => ({
        id: suggestion.id,
        title: suggestion.suggestionHe,
        estimatedSavingPct: suggestion.estimatedSavingPct,
        status: suggestion.status,
      }),
    ),
    equipmentSummary: buildTwinEquipmentSummary(twinEquipment.assets),
  };
}
