import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type EquipmentRepository,
  type PersistedEquipmentAsset,
  type PersistedEquipmentSignal,
  type PersistedMaintenancePrediction,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import {
  buildTwinEquipment,
  buildTwinEquipmentSummary,
  computeTwinEquipmentHealth,
  TWIN_EQUIPMENT_MAX_ASSETS,
  TWIN_EQUIPMENT_MAX_SIGNALS,
  TWIN_EQUIPMENT_SUMMARY_TOP_ITEMS,
} from "./build-twin-equipment.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
const now = "2026-08-04T10:00:00.000Z";

function asset(
  overrides: Partial<PersistedEquipmentAsset> & { readonly id: string },
): PersistedEquipmentAsset {
  return {
    tenantId,
    hotelId,
    code: "ASSET-1",
    nameHe: "נכס",
    category: "hvac",
    locationHe: "לובי",
    installDate: null,
    createdAt: now,
    ...overrides,
  };
}

function prediction(
  overrides: Partial<PersistedMaintenancePrediction> & {
    readonly id: string;
    readonly assetId: string;
  },
): PersistedMaintenancePrediction {
  return {
    tenantId,
    hotelId,
    riskScore: 50,
    rationaleHe: "סימן חיזוי",
    recommendedActionHe: "בדיקה",
    status: "open",
    taskId: null,
    createdAt: now,
    ...overrides,
  };
}

function signal(
  overrides: Partial<PersistedEquipmentSignal> & {
    readonly id: string;
    readonly assetId: string;
  },
): PersistedEquipmentSignal {
  return {
    tenantId,
    hotelId,
    signalType: "generic",
    valueNum: null,
    valueText: null,
    recordedAt: now,
    source: "webhook",
    createdAt: now,
    ...overrides,
  };
}

function createDeps(input: {
  readonly assets?: readonly PersistedEquipmentAsset[];
  readonly predictions?: readonly PersistedMaintenancePrediction[];
  readonly signalsByAsset?: Readonly<
    Record<string, readonly PersistedEquipmentSignal[]>
  >;
}): BuildTwinEquipmentDeps {
  return {
    equipment: {
      listAssetsByHotel: async (_t: TenantId, _h: HotelId) =>
        input.assets ?? [],
      listOpenPredictionsByHotel: async () => input.predictions ?? [],
      listSignalsByAsset: async (_t: TenantId, assetId: string, limit?: number) =>
        (input.signalsByAsset?.[assetId] ?? []).slice(0, limit ?? 50),
    } as unknown as EquipmentRepository,
  };
}

type BuildTwinEquipmentDeps = Parameters<typeof buildTwinEquipment>[0];

describe("computeTwinEquipmentHealth", () => {
  it("marks critical when open prediction risk is at least 70", () => {
    assert.equal(
      computeTwinEquipmentHealth({
        nowIso: now,
        openPrediction: prediction({
          id: "pm-1",
          assetId: "a-1",
          riskScore: 70,
        }),
        signals: [],
      }),
      "critical",
    );
  });

  it("marks warning when prediction risk is at least 40", () => {
    assert.equal(
      computeTwinEquipmentHealth({
        nowIso: now,
        openPrediction: prediction({
          id: "pm-1",
          assetId: "a-1",
          riskScore: 45,
        }),
        signals: [],
      }),
      "warning",
    );
  });

  it("marks warning on recent error_code signal", () => {
    assert.equal(
      computeTwinEquipmentHealth({
        nowIso: now,
        openPrediction: null,
        signals: [
          signal({
            id: "s-1",
            assetId: "a-1",
            signalType: "error_code",
            valueText: "E42",
            recordedAt: "2026-08-03T08:00:00.000Z",
          }),
        ],
      }),
      "warning",
    );
  });

  it("returns ok when no elevated risk", () => {
    assert.equal(
      computeTwinEquipmentHealth({
        nowIso: now,
        openPrediction: null,
        signals: [
          signal({
            id: "s-1",
            assetId: "a-1",
            signalType: "temp_c",
            valueNum: 22,
          }),
        ],
      }),
      "ok",
    );
  });
});

describe("buildTwinEquipment", () => {
  it("returns capped assets with open prediction and latest signals", async () => {
    const hvac = asset({
      id: "a-hvac",
      code: "HVAC-LOBBY",
      category: "hvac",
      nameHe: "מיזוג לובי",
    });
    const boiler = asset({
      id: "a-boiler",
      code: "BOILER-1",
      category: "boiler",
      nameHe: "דוד",
    });

    const result = await buildTwinEquipment(
      createDeps({
        assets: [hvac, boiler],
        predictions: [
          prediction({
            id: "pm-1",
            assetId: "a-boiler",
            riskScore: 82,
            status: "acknowledged",
          }),
        ],
        signalsByAsset: {
          "a-hvac": [
            signal({
              id: "s-1",
              assetId: "a-hvac",
              signalType: "temp_c",
              valueNum: 21,
            }),
            signal({
              id: "s-2",
              assetId: "a-hvac",
              signalType: "runtime_hours",
              valueNum: 100,
            }),
          ],
        },
      }),
      tenantId,
      hotelId,
      now,
    );

    assert.equal(result.assets.length, 2);
    assert.equal(result.generatedAt, now);

    const hvacNode = result.assets.find((node) => node.assetId === "a-hvac");
    assert.ok(hvacNode);
    assert.equal(hvacNode.health, "ok");
    assert.equal(hvacNode.latestSignals.length, 2);
    assert.equal(hvacNode.openPrediction, undefined);

    const boilerNode = result.assets.find((node) => node.assetId === "a-boiler");
    assert.ok(boilerNode);
    assert.equal(boilerNode.health, "critical");
    assert.equal(boilerNode.openPrediction?.riskScore, 82);
  });

  it("caps assets and signals per node", async () => {
    const assets = Array.from({ length: TWIN_EQUIPMENT_MAX_ASSETS + 5 }, (_, i) =>
      asset({
        id: `a-${i}`,
        code: `Z-${String(i).padStart(3, "0")}`,
      }),
    );

    const result = await buildTwinEquipment(
      createDeps({
        assets,
        signalsByAsset: {
          "a-0": Array.from({ length: TWIN_EQUIPMENT_MAX_SIGNALS + 2 }, (_, i) =>
            signal({
              id: `s-${i}`,
              assetId: "a-0",
              signalType: "generic",
            }),
          ),
        },
      }),
      tenantId,
      hotelId,
      now,
    );

    assert.equal(result.assets.length, TWIN_EQUIPMENT_MAX_ASSETS);
    assert.equal(result.assets[0]?.latestSignals.length, TWIN_EQUIPMENT_MAX_SIGNALS);
  });
});

describe("buildTwinEquipmentSummary", () => {
  it("aggregates counts and caps topItems", async () => {
    const equipment = await buildTwinEquipment(
      createDeps({
        assets: [
          asset({ id: "a-1", code: "HVAC-1", category: "hvac" }),
          asset({ id: "a-2", code: "ELV-1", category: "elevator" }),
          asset({ id: "a-3", code: "BOILER-1", category: "boiler" }),
        ],
        predictions: [
          prediction({ id: "pm-1", assetId: "a-2", riskScore: 75 }),
          prediction({ id: "pm-2", assetId: "a-3", riskScore: 55 }),
        ],
      }),
      tenantId,
      hotelId,
      now,
    );

    const summary = buildTwinEquipmentSummary(equipment.assets);
    assert.equal(summary.count, 3);
    assert.equal(summary.byCategory.hvac, 1);
    assert.equal(summary.byCategory.elevator, 1);
    assert.equal(summary.byCategory.boiler, 1);
    assert.equal(summary.criticalCount, 1);
    assert.equal(summary.warningCount, 1);
    assert.equal(summary.topItems.length, 3);
    assert.ok(summary.topItems.length <= TWIN_EQUIPMENT_SUMMARY_TOP_ITEMS);
    assert.equal(summary.topItems[0]?.health, "critical");
  });
});
