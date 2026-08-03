import { and, desc, eq, inArray } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import {
  equipmentAssets,
  equipmentSignals,
  maintenancePredictions,
} from "../schema/ops.js";

export type EquipmentAssetCategory =
  | "hvac"
  | "elevator"
  | "boiler"
  | "other";

export type EquipmentSignalType =
  | "runtime_hours"
  | "error_code"
  | "temp_c"
  | "vibration"
  | "generic";

export type EquipmentSignalSource = "manual" | "webhook" | "derived";

export type MaintenancePredictionStatus =
  | "open"
  | "acknowledged"
  | "dismissed"
  | "converted";

export type PersistedEquipmentAsset = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly code: string;
  readonly nameHe: string;
  readonly category: EquipmentAssetCategory;
  readonly locationHe: string;
  readonly installDate: string | null;
  readonly createdAt: string;
};

export type PersistedEquipmentSignal = {
  readonly id: string;
  readonly assetId: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly signalType: EquipmentSignalType;
  readonly valueNum: number | null;
  readonly valueText: string | null;
  readonly recordedAt: string;
  readonly source: EquipmentSignalSource;
  readonly createdAt: string;
};

export type PersistedMaintenancePrediction = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly assetId: string;
  readonly riskScore: number;
  readonly rationaleHe: string;
  readonly recommendedActionHe: string;
  readonly status: MaintenancePredictionStatus;
  readonly taskId: string | null;
  readonly createdAt: string;
};

export type CreateEquipmentAssetInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly code: string;
  readonly nameHe: string;
  readonly category: EquipmentAssetCategory;
  readonly locationHe: string;
  readonly installDate?: string;
  readonly createdAt: string;
};

export type CreateEquipmentSignalInput = {
  readonly id: string;
  readonly assetId: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly signalType: EquipmentSignalType;
  readonly valueNum?: number | null;
  readonly valueText?: string | null;
  readonly recordedAt: string;
  readonly source: EquipmentSignalSource;
  readonly createdAt: string;
};

export type CreateMaintenancePredictionInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly assetId: string;
  readonly riskScore: number;
  readonly rationaleHe: string;
  readonly recommendedActionHe: string;
  readonly taskId?: string;
  readonly createdAt: string;
};

const assetCategories: readonly EquipmentAssetCategory[] = [
  "hvac",
  "elevator",
  "boiler",
  "other",
];

const signalTypes: readonly EquipmentSignalType[] = [
  "runtime_hours",
  "error_code",
  "temp_c",
  "vibration",
  "generic",
];

const signalSources: readonly EquipmentSignalSource[] = [
  "manual",
  "webhook",
  "derived",
];

const predictionStatuses: readonly MaintenancePredictionStatus[] = [
  "open",
  "acknowledged",
  "dismissed",
  "converted",
];

function asAssetCategory(value: string): EquipmentAssetCategory {
  if ((assetCategories as readonly string[]).includes(value)) {
    return value as EquipmentAssetCategory;
  }
  throw new Error("INVALID_EQUIPMENT_ASSET_CATEGORY");
}

function asSignalType(value: string): EquipmentSignalType {
  if ((signalTypes as readonly string[]).includes(value)) {
    return value as EquipmentSignalType;
  }
  throw new Error("INVALID_EQUIPMENT_SIGNAL_TYPE");
}

function asSignalSource(value: string): EquipmentSignalSource {
  if ((signalSources as readonly string[]).includes(value)) {
    return value as EquipmentSignalSource;
  }
  throw new Error("INVALID_EQUIPMENT_SIGNAL_SOURCE");
}

function asPredictionStatus(value: string): MaintenancePredictionStatus {
  if ((predictionStatuses as readonly string[]).includes(value)) {
    return value as MaintenancePredictionStatus;
  }
  throw new Error("INVALID_MAINTENANCE_PREDICTION_STATUS");
}

function mapAsset(
  row: typeof equipmentAssets.$inferSelect,
): PersistedEquipmentAsset {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    code: row.code,
    nameHe: row.nameHe,
    category: asAssetCategory(row.category),
    locationHe: row.locationHe,
    installDate: row.installDate ?? null,
    createdAt: row.createdAt,
  };
}

function mapSignal(
  row: typeof equipmentSignals.$inferSelect,
): PersistedEquipmentSignal {
  return {
    id: row.id,
    assetId: row.assetId,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    signalType: asSignalType(row.signalType),
    valueNum: row.valueNum ?? null,
    valueText: row.valueText ?? null,
    recordedAt: row.recordedAt,
    source: asSignalSource(row.source),
    createdAt: row.createdAt,
  };
}

function mapPrediction(
  row: typeof maintenancePredictions.$inferSelect,
): PersistedMaintenancePrediction {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    assetId: row.assetId,
    riskScore: row.riskScore,
    rationaleHe: row.rationaleHe,
    recommendedActionHe: row.recommendedActionHe,
    status: asPredictionStatus(row.status),
    taskId: row.taskId ?? null,
    createdAt: row.createdAt,
  };
}

export type EquipmentRepository = {
  createAsset: (
    input: CreateEquipmentAssetInput,
  ) => Promise<PersistedEquipmentAsset>;
  listAssetsByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedEquipmentAsset[]>;
  findAssetById: (
    tenantId: TenantId,
    assetId: string,
  ) => Promise<PersistedEquipmentAsset | null>;
  findAssetByCode: (
    tenantId: TenantId,
    hotelId: HotelId,
    code: string,
  ) => Promise<PersistedEquipmentAsset | null>;
  createSignal: (
    input: CreateEquipmentSignalInput,
  ) => Promise<PersistedEquipmentSignal>;
  listSignalsByAsset: (
    tenantId: TenantId,
    assetId: string,
    limit?: number,
  ) => Promise<readonly PersistedEquipmentSignal[]>;
  listSignalsByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    limit?: number,
  ) => Promise<readonly PersistedEquipmentSignal[]>;
  createPrediction: (
    input: CreateMaintenancePredictionInput,
  ) => Promise<PersistedMaintenancePrediction>;
  listPredictionsByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    status?: MaintenancePredictionStatus,
  ) => Promise<readonly PersistedMaintenancePrediction[]>;
  listOpenPredictionsByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedMaintenancePrediction[]>;
  findPredictionById: (
    tenantId: TenantId,
    predictionId: string,
  ) => Promise<PersistedMaintenancePrediction | null>;
  linkPredictionTask: (
    tenantId: TenantId,
    predictionId: string,
    taskId: string,
  ) => Promise<PersistedMaintenancePrediction | null>;
  decidePrediction: (
    tenantId: TenantId,
    hotelId: HotelId,
    predictionId: string,
    status: MaintenancePredictionStatus,
  ) => Promise<PersistedMaintenancePrediction | null>;
};

export function createEquipmentRepository(db: HotelOsDb): EquipmentRepository {
  return {
    async createAsset(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        code: input.code,
        nameHe: input.nameHe,
        category: input.category,
        locationHe: input.locationHe,
        installDate: input.installDate ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(equipmentAssets).values(row).run();
      return mapAsset(row);
    },

    async listAssetsByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(equipmentAssets)
        .where(
          and(
            eq(equipmentAssets.tenantId, tenantId),
            eq(equipmentAssets.hotelId, hotelId),
          ),
        )
        .orderBy(equipmentAssets.code)
        .all();
      return rows.map(mapAsset);
    },

    async findAssetById(tenantId, assetId) {
      const row = await db
        .select()
        .from(equipmentAssets)
        .where(
          and(
            eq(equipmentAssets.id, assetId),
            eq(equipmentAssets.tenantId, tenantId),
          ),
        )
        .get();
      return row ? mapAsset(row) : null;
    },

    async findAssetByCode(tenantId, hotelId, code) {
      const row = await db
        .select()
        .from(equipmentAssets)
        .where(
          and(
            eq(equipmentAssets.tenantId, tenantId),
            eq(equipmentAssets.hotelId, hotelId),
            eq(equipmentAssets.code, code),
          ),
        )
        .get();
      return row ? mapAsset(row) : null;
    },

    async createSignal(input) {
      const row = {
        id: input.id,
        assetId: input.assetId,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        signalType: input.signalType,
        valueNum: input.valueNum ?? null,
        valueText: input.valueText ?? null,
        recordedAt: input.recordedAt,
        source: input.source,
        createdAt: input.createdAt,
      };
      await db.insert(equipmentSignals).values(row).run();
      return mapSignal(row);
    },

    async listSignalsByAsset(tenantId, assetId, limit = 50) {
      const rows = await db
        .select()
        .from(equipmentSignals)
        .where(
          and(
            eq(equipmentSignals.tenantId, tenantId),
            eq(equipmentSignals.assetId, assetId),
          ),
        )
        .orderBy(desc(equipmentSignals.recordedAt))
        .limit(limit)
        .all();
      return rows.map(mapSignal);
    },

    async listSignalsByHotel(tenantId, hotelId, limit = 200) {
      const rows = await db
        .select()
        .from(equipmentSignals)
        .where(
          and(
            eq(equipmentSignals.tenantId, tenantId),
            eq(equipmentSignals.hotelId, hotelId),
          ),
        )
        .orderBy(desc(equipmentSignals.recordedAt))
        .limit(limit)
        .all();
      return rows.map(mapSignal);
    },

    async createPrediction(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        assetId: input.assetId,
        riskScore: input.riskScore,
        rationaleHe: input.rationaleHe,
        recommendedActionHe: input.recommendedActionHe,
        status: "open" as const,
        taskId: input.taskId ?? null,
        createdAt: input.createdAt,
      };
      await db.insert(maintenancePredictions).values(row).run();
      return mapPrediction(row);
    },

    async listPredictionsByHotel(tenantId, hotelId, status) {
      const conditions = [
        eq(maintenancePredictions.tenantId, tenantId),
        eq(maintenancePredictions.hotelId, hotelId),
      ];
      if (status) {
        conditions.push(eq(maintenancePredictions.status, status));
      }
      const rows = await db
        .select()
        .from(maintenancePredictions)
        .where(and(...conditions))
        .orderBy(desc(maintenancePredictions.riskScore), desc(maintenancePredictions.createdAt))
        .all();
      return rows.map(mapPrediction);
    },

    async listOpenPredictionsByHotel(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(maintenancePredictions)
        .where(
          and(
            eq(maintenancePredictions.tenantId, tenantId),
            eq(maintenancePredictions.hotelId, hotelId),
            inArray(maintenancePredictions.status, ["open", "acknowledged"]),
          ),
        )
        .orderBy(desc(maintenancePredictions.riskScore))
        .all();
      return rows.map(mapPrediction);
    },

    async findPredictionById(tenantId, predictionId) {
      const row = await db
        .select()
        .from(maintenancePredictions)
        .where(
          and(
            eq(maintenancePredictions.id, predictionId),
            eq(maintenancePredictions.tenantId, tenantId),
          ),
        )
        .get();
      return row ? mapPrediction(row) : null;
    },

    async linkPredictionTask(tenantId, predictionId, taskId) {
      await db
        .update(maintenancePredictions)
        .set({ taskId, status: "converted" })
        .where(
          and(
            eq(maintenancePredictions.id, predictionId),
            eq(maintenancePredictions.tenantId, tenantId),
          ),
        )
        .run();
      return this.findPredictionById(tenantId, predictionId);
    },

    async decidePrediction(tenantId, hotelId, predictionId, status) {
      await db
        .update(maintenancePredictions)
        .set({ status })
        .where(
          and(
            eq(maintenancePredictions.id, predictionId),
            eq(maintenancePredictions.tenantId, tenantId),
            eq(maintenancePredictions.hotelId, hotelId),
            inArray(maintenancePredictions.status, ["open", "acknowledged"]),
          ),
        )
        .run();
      return this.findPredictionById(tenantId, predictionId);
    },
  };
}
