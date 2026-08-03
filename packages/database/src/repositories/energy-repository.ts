import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { energyReadings, energySuggestions } from "../schema/ops.js";

export type EnergyMeterKind = "electric" | "hvac" | "water" | "generic";

export type EnergySuggestionStatus = "suggested" | "accepted" | "dismissed";

export type PersistedEnergyReading = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly meterKind: EnergyMeterKind;
  readonly kwh: number | null;
  readonly recordedAt: string;
  readonly source: string;
};

export type PersistedEnergySuggestion = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly periodDate: string;
  readonly occupancyPct: number;
  readonly suggestionHe: string;
  readonly estimatedSavingPct: number;
  readonly status: EnergySuggestionStatus;
  readonly createdAt: string;
};

export type CreateEnergyReadingInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly meterKind: EnergyMeterKind;
  readonly kwh: number | null;
  readonly recordedAt: string;
  readonly source: string;
};

export type CreateEnergySuggestionInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly periodDate: string;
  readonly occupancyPct: number;
  readonly suggestionHe: string;
  readonly estimatedSavingPct: number;
  readonly createdAt: string;
};

const meterKinds: readonly EnergyMeterKind[] = [
  "electric",
  "hvac",
  "water",
  "generic",
];

const suggestionStatuses: readonly EnergySuggestionStatus[] = [
  "suggested",
  "accepted",
  "dismissed",
];

function asMeterKind(value: string): EnergyMeterKind {
  if ((meterKinds as readonly string[]).includes(value)) {
    return value as EnergyMeterKind;
  }
  throw new Error("INVALID_ENERGY_METER_KIND");
}

function asSuggestionStatus(value: string): EnergySuggestionStatus {
  if ((suggestionStatuses as readonly string[]).includes(value)) {
    return value as EnergySuggestionStatus;
  }
  throw new Error("INVALID_ENERGY_SUGGESTION_STATUS");
}

function mapReading(
  row: typeof energyReadings.$inferSelect,
): PersistedEnergyReading {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    meterKind: asMeterKind(row.meterKind),
    kwh: row.kwh ?? null,
    recordedAt: row.recordedAt,
    source: row.source,
  };
}

function mapSuggestion(
  row: typeof energySuggestions.$inferSelect,
): PersistedEnergySuggestion {
  return {
    id: row.id,
    tenantId: row.tenantId as TenantId,
    hotelId: row.hotelId as HotelId,
    periodDate: row.periodDate,
    occupancyPct: row.occupancyPct,
    suggestionHe: row.suggestionHe,
    estimatedSavingPct: row.estimatedSavingPct,
    status: asSuggestionStatus(row.status),
    createdAt: row.createdAt,
  };
}

export type EnergyRepository = {
  createReading: (
    input: CreateEnergyReadingInput,
  ) => Promise<PersistedEnergyReading>;
  listRecentReadings: (
    tenantId: TenantId,
    hotelId: HotelId,
    limit?: number,
  ) => Promise<readonly PersistedEnergyReading[]>;
  listSuggestionsByHotel: (
    tenantId: TenantId,
    hotelId: HotelId,
    status?: EnergySuggestionStatus,
  ) => Promise<readonly PersistedEnergySuggestion[]>;
  findSuggestionById: (
    tenantId: TenantId,
    suggestionId: string,
  ) => Promise<PersistedEnergySuggestion | null>;
  deleteSuggestedForDate: (
    tenantId: TenantId,
    hotelId: HotelId,
    periodDate: string,
  ) => Promise<void>;
  createSuggestions: (
    inputs: readonly CreateEnergySuggestionInput[],
  ) => Promise<readonly PersistedEnergySuggestion[]>;
  decideSuggestion: (
    tenantId: TenantId,
    hotelId: HotelId,
    suggestionId: string,
    status: "accepted" | "dismissed",
  ) => Promise<PersistedEnergySuggestion | null>;
};

export function createEnergyRepository(db: HotelOsDb): EnergyRepository {
  return {
    async createReading(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        meterKind: input.meterKind,
        kwh: input.kwh,
        recordedAt: input.recordedAt,
        source: input.source,
      };
      await db.insert(energyReadings).values(row).run();
      return mapReading(row);
    },

    async listRecentReadings(tenantId, hotelId, limit = 10) {
      const rows = await db
        .select()
        .from(energyReadings)
        .where(
          and(
            eq(energyReadings.tenantId, tenantId),
            eq(energyReadings.hotelId, hotelId),
          ),
        )
        .orderBy(desc(energyReadings.recordedAt))
        .limit(limit)
        .all();
      return rows.map(mapReading);
    },

    async listSuggestionsByHotel(tenantId, hotelId, status) {
      const conditions = [
        eq(energySuggestions.tenantId, tenantId),
        eq(energySuggestions.hotelId, hotelId),
      ];
      if (status) {
        conditions.push(eq(energySuggestions.status, status));
      }
      const rows = await db
        .select()
        .from(energySuggestions)
        .where(and(...conditions))
        .orderBy(desc(energySuggestions.periodDate), desc(energySuggestions.createdAt))
        .all();
      return rows.map(mapSuggestion);
    },

    async findSuggestionById(tenantId, suggestionId) {
      const row = await db
        .select()
        .from(energySuggestions)
        .where(
          and(
            eq(energySuggestions.tenantId, tenantId),
            eq(energySuggestions.id, suggestionId),
          ),
        )
        .get();
      return row ? mapSuggestion(row) : null;
    },

    async deleteSuggestedForDate(tenantId, hotelId, periodDate) {
      await db
        .delete(energySuggestions)
        .where(
          and(
            eq(energySuggestions.tenantId, tenantId),
            eq(energySuggestions.hotelId, hotelId),
            eq(energySuggestions.periodDate, periodDate),
            eq(energySuggestions.status, "suggested"),
          ),
        )
        .run();
    },

    async createSuggestions(inputs) {
      if (inputs.length === 0) {
        return [];
      }
      await db.insert(energySuggestions).values(
        inputs.map((input) => ({
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          periodDate: input.periodDate,
          occupancyPct: input.occupancyPct,
          suggestionHe: input.suggestionHe,
          estimatedSavingPct: input.estimatedSavingPct,
          status: "suggested",
          createdAt: input.createdAt,
        })),
      );
      const createdIds = inputs.map((input) => input.id);
      const rows = await db
        .select()
        .from(energySuggestions)
        .where(
          and(
            eq(energySuggestions.tenantId, inputs[0]!.tenantId),
            eq(energySuggestions.hotelId, inputs[0]!.hotelId),
          ),
        )
        .orderBy(desc(energySuggestions.createdAt))
        .all();
      return rows.filter((row) => createdIds.includes(row.id)).map(mapSuggestion);
    },

    async decideSuggestion(tenantId, hotelId, suggestionId, status) {
      await db
        .update(energySuggestions)
        .set({ status })
        .where(
          and(
            eq(energySuggestions.id, suggestionId),
            eq(energySuggestions.tenantId, tenantId),
            eq(energySuggestions.hotelId, hotelId),
            eq(energySuggestions.status, "suggested"),
          ),
        )
        .run();

      const row = await db
        .select()
        .from(energySuggestions)
        .where(
          and(
            eq(energySuggestions.id, suggestionId),
            eq(energySuggestions.tenantId, tenantId),
            eq(energySuggestions.hotelId, hotelId),
          ),
        )
        .get();
      return row ? mapSuggestion(row) : null;
    },
  };
}
