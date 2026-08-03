import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type EnergyRepository,
  type EquipmentRepository,
  type HotelRepository,
  type MaintenanceRepository,
  type OpsRepository,
  type PersistedEnergySuggestion,
  type PersistedEquipmentAsset,
  type PersistedHotel,
  type PersistedMaintenancePrediction,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import {
  buildTwinOverlays,
  TWIN_OVERLAY_TOP_ITEMS,
} from "./build-twin-overlays.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);

const demoHotel: PersistedHotel = {
  id: hotelId,
  tenantId,
  chainId: "chain-demo",
  name: "TLV Demo",
  timezone: "Asia/Jerusalem",
  currency: "ILS",
  kashrutEnabled: false,
  enabledIntegrationDomains: [],
};

function prediction(
  overrides: Partial<PersistedMaintenancePrediction> & { readonly id: string },
): PersistedMaintenancePrediction {
  return {
    tenantId,
    hotelId,
    assetId: "asset-1",
    riskScore: 50,
    rationaleHe: "סימן חיזוי",
    recommendedActionHe: "בדיקה",
    status: "open",
    taskId: null,
    createdAt: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

function energySuggestion(
  overrides: Partial<PersistedEnergySuggestion> & { readonly id: string },
): PersistedEnergySuggestion {
  return {
    tenantId,
    hotelId,
    periodDate: "2026-08-03",
    occupancyPct: 35,
    suggestionHe: "הפחת HVAC",
    estimatedSavingPct: 10,
    status: "suggested",
    createdAt: "2026-08-03T06:00:00.000Z",
    ...overrides,
  };
}

function createDeps(input: {
  readonly predictions?: readonly PersistedMaintenancePrediction[];
  readonly energy?: readonly PersistedEnergySuggestion[];
  readonly assets?: readonly PersistedEquipmentAsset[];
}): Parameters<typeof buildTwinOverlays>[0] {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
  };

  return {
    hotels: {
      listByTenant: async () => [demoHotel],
    } as unknown as HotelRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      findDepartmentByCode: async (
        _t: TenantId,
        _h: HotelId,
        code: string,
      ) =>
        deptIds[code]
          ? {
              id: deptIds[code]!,
              hotelId,
              code,
              name: code,
            }
          : null,
      listTasksByDepartment: async () => [],
    } as unknown as OpsRepository,
    maintenance: {
      listByHotel: async () => [],
    } as unknown as MaintenanceRepository,
    equipment: {
      listOpenPredictionsByHotel: async () => input.predictions ?? [],
      listAssetsByHotel: async () => input.assets ?? [],
      listSignalsByAsset: async () => [],
    } as unknown as EquipmentRepository,
    energy: {
      listSuggestionsByHotel: async (
        _t: TenantId,
        _h: HotelId,
        status?: "suggested" | "accepted" | "dismissed",
      ) => (status === "suggested" ? (input.energy ?? []) : []),
    } as unknown as EnergyRepository,
  };
}

describe("buildTwinOverlays", () => {
  it("summarizes incidents, predictive alerts, and energy hints", async () => {
    const overlays = await buildTwinOverlays(
      createDeps({
        predictions: [
          prediction({ id: "pm-low", riskScore: 40 }),
          prediction({ id: "pm-high", riskScore: 90 }),
        ],
        energy: [
          energySuggestion({ id: "e-1", estimatedSavingPct: 12 }),
          energySuggestion({ id: "e-2", estimatedSavingPct: 8 }),
        ],
      }),
      tenantId,
      hotelId,
    );

    assert.equal(overlays.openIncidents.count, 0);
    assert.equal(overlays.predictiveAlerts.count, 2);
    assert.equal(overlays.predictiveAlerts.topItems[0]?.id, "pm-high");
    assert.equal(overlays.energyHints.count, 2);
    assert.equal(overlays.energyHints.topItems[0]?.id, "e-1");
    assert.equal(overlays.equipmentSummary.count, 0);
    assert.ok(overlays.generatedAt.length > 0);
  });

  it("enriches predictive alerts with asset codes and equipment summary", async () => {
    const overlays = await buildTwinOverlays(
      createDeps({
        predictions: [
          prediction({
            id: "pm-1",
            assetId: "asset-boiler",
            riskScore: 80,
          }),
        ],
        assets: [
          {
            id: "asset-boiler",
            tenantId,
            hotelId,
            code: "BOILER-1",
            nameHe: "דוד",
            category: "boiler",
            locationHe: "מרתף",
            installDate: null,
            createdAt: "2026-08-03T10:00:00.000Z",
          },
        ],
      }),
      tenantId,
      hotelId,
    );

    assert.equal(overlays.predictiveAlerts.topItems[0]?.assetId, "asset-boiler");
    assert.equal(overlays.predictiveAlerts.topItems[0]?.assetCode, "BOILER-1");
    assert.equal(overlays.equipmentSummary.count, 1);
    assert.equal(overlays.equipmentSummary.byCategory.boiler, 1);
    assert.equal(overlays.equipmentSummary.criticalCount, 1);
  });

  it("caps topItems at TWIN_OVERLAY_TOP_ITEMS", async () => {
    const predictions = Array.from({ length: TWIN_OVERLAY_TOP_ITEMS + 3 }, (_, i) =>
      prediction({
        id: `pm-${i}`,
        riskScore: 100 - i,
        createdAt: `2026-08-03T${String(i).padStart(2, "0")}:00:00.000Z`,
      }),
    );

    const overlays = await buildTwinOverlays(
      createDeps({ predictions }),
      tenantId,
      hotelId,
    );

    assert.equal(overlays.predictiveAlerts.count, TWIN_OVERLAY_TOP_ITEMS + 3);
    assert.equal(
      overlays.predictiveAlerts.topItems.length,
      TWIN_OVERLAY_TOP_ITEMS,
    );
  });
});
