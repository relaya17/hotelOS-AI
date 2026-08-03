import { randomUUID } from "node:crypto";
import type {
  BookingRepository,
  CreateEnergySuggestionInput,
  EnergyRepository,
  OverviewRepository,
  PersistedEnergySuggestion,
  PersistedRoom,
  RoomRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import {
  countOccupiedRoomsOnNight,
  projectedOccupancyPct,
} from "./suggest-revenue-rates.js";

/** Occupancy below this % triggers HVAC setback suggestions. */
export const ENERGY_LOW_OCCUPANCY_PCT = 40;

/** Occupancy at or above this % triggers peak-load warnings. */
export const ENERGY_HIGH_OCCUPANCY_PCT = 85;

/** Minimum vacant rooms on a floor to suggest HVAC reduction. */
export const ENERGY_EMPTY_FLOOR_MIN_ROOMS = 2;

export type EnergySuggestionDraft = {
  readonly periodDate: string;
  readonly occupancyPct: number;
  readonly suggestionHe: string;
  readonly estimatedSavingPct: number;
};

export type SuggestEnergyActionsInput = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly now?: Date;
};

export type SuggestEnergyActionsDeps = {
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly rooms: RoomRepository;
  readonly energy: EnergyRepository;
};

export type SuggestEnergyActionsResult = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly periodDate: string;
  readonly generatedAt: string;
  readonly suggestions: readonly PersistedEnergySuggestion[];
};

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function findEmptyFloors(
  roomList: readonly PersistedRoom[],
  occupiedRoomIds: ReadonlySet<string>,
): readonly string[] {
  const byFloor = new Map<string, { total: number; vacant: number }>();

  for (const room of roomList) {
    const stats = byFloor.get(room.floor) ?? { total: 0, vacant: 0 };
    stats.total += 1;
    if (!occupiedRoomIds.has(room.id)) {
      stats.vacant += 1;
    }
    byFloor.set(room.floor, stats);
  }

  const emptyFloors: string[] = [];
  for (const [floor, stats] of byFloor) {
    if (
      stats.total >= ENERGY_EMPTY_FLOOR_MIN_ROOMS &&
      stats.vacant === stats.total
    ) {
      emptyFloors.push(floor);
    }
  }
  return emptyFloors.sort((a, b) => a.localeCompare(b, "he"));
}

export function buildEnergySuggestionDrafts(
  periodDate: string,
  occupancyPct: number,
  emptyFloors: readonly string[],
): readonly EnergySuggestionDraft[] {
  const drafts: EnergySuggestionDraft[] = [];

  if (occupancyPct < ENERGY_LOW_OCCUPANCY_PCT) {
    const saving = Math.min(
      15,
      Math.max(8, ENERGY_LOW_OCCUPANCY_PCT - occupancyPct),
    );
    drafts.push({
      periodDate,
      occupancyPct,
      suggestionHe: `תפוסה נמוכה (${occupancyPct}%) — מומלץ setback ל-HVAC באזורים לא מאוכלסים (חיסכון משוער ~${saving}%).`,
      estimatedSavingPct: saving,
    });
  }

  if (occupancyPct >= ENERGY_HIGH_OCCUPANCY_PCT) {
    drafts.push({
      periodDate,
      occupancyPct,
      suggestionHe: `תפוסה גבוהה (${occupancyPct}%) — אזהרת peak load: בדקו עומס חשמל/מיזוג בשעות שיא ושקלו pre-cooling מוקדם.`,
      estimatedSavingPct: 0,
    });
  }

  for (const floor of emptyFloors) {
    drafts.push({
      periodDate,
      occupancyPct,
      suggestionHe: `קומה ${floor} ריקה לחלוטין — כבו/הנמיכו HVAC בקומה (חיסכון משוער ~10%).`,
      estimatedSavingPct: 10,
    });
  }

  if (drafts.length === 0) {
    drafts.push({
      periodDate,
      occupancyPct,
      suggestionHe: `תפוסה ${occupancyPct}% — אין פעולה דחופה; המשיכו מעקב יומי.`,
      estimatedSavingPct: 0,
    });
  }

  return drafts;
}

export async function suggestEnergyActions(
  deps: SuggestEnergyActionsDeps,
  input: SuggestEnergyActionsInput,
): Promise<SuggestEnergyActionsResult | null> {
  const chain = await deps.overview.getChainOverview(input.tenantId);
  if (!chain) {
    return null;
  }

  const hotel = chain.hotels.find((row) => row.id === input.hotelId);
  if (!hotel) {
    return null;
  }

  const now = input.now ?? new Date();
  const periodDate = formatDateUtc(now);
  const bookings = await deps.bookings.listByHotel(
    input.tenantId,
    input.hotelId,
  );
  const roomList = await deps.rooms.listByHotel(
    input.tenantId,
    input.hotelId,
  );

  const occupiedCount = countOccupiedRoomsOnNight(bookings, periodDate);
  const occupancyPct = projectedOccupancyPct(occupiedCount, hotel.rooms.total);

  const occupiedRoomIds = new Set<string>();
  for (const booking of bookings) {
    if (
      (booking.status === "confirmed" || booking.status === "checked_in") &&
      booking.checkInDate <= periodDate &&
      periodDate < booking.checkOutDate
    ) {
      occupiedRoomIds.add(booking.roomId);
    }
  }

  const emptyFloors = findEmptyFloors(roomList, occupiedRoomIds);
  const drafts = buildEnergySuggestionDrafts(
    periodDate,
    occupancyPct,
    emptyFloors,
  );

  await deps.energy.deleteSuggestedForDate(
    input.tenantId,
    input.hotelId,
    periodDate,
  );

  const createdAt = now.toISOString();
  const toCreate: CreateEnergySuggestionInput[] = drafts.map((draft) => ({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    periodDate: draft.periodDate,
    occupancyPct: draft.occupancyPct,
    suggestionHe: draft.suggestionHe,
    estimatedSavingPct: draft.estimatedSavingPct,
    createdAt,
  }));

  const suggestions = await deps.energy.createSuggestions(toCreate);

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    periodDate,
    generatedAt: createdAt,
    suggestions,
  };
}

export type DecideEnergySuggestionResult =
  | { readonly ok: true; readonly suggestion: PersistedEnergySuggestion }
  | {
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

export async function decideEnergySuggestion(
  energy: EnergyRepository,
  input: {
    readonly tenantId: TenantId;
    readonly hotelId: HotelId;
    readonly suggestionId: string;
    readonly decision: "accepted" | "dismissed";
  },
): Promise<DecideEnergySuggestionResult> {
  const existing = await energy.findSuggestionById(
    input.tenantId,
    input.suggestionId,
  );
  if (!existing) {
    return {
      ok: false,
      error: { code: "SUGGESTION_NOT_FOUND", message: "הצעה לא נמצאה" },
    };
  }
  if (existing.hotelId !== input.hotelId) {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "אין גישה למלון זה" },
    };
  }
  if (existing.status !== "suggested") {
    return {
      ok: false,
      error: {
        code: "ALREADY_DECIDED",
        message: "ההצעה כבר נסגרה",
      },
    };
  }

  const updated = await energy.decideSuggestion(
    input.tenantId,
    input.hotelId,
    input.suggestionId,
    input.decision,
  );
  if (!updated) {
    return {
      ok: false,
      error: { code: "SUGGESTION_NOT_FOUND", message: "הצעה לא נמצאה" },
    };
  }
  return { ok: true, suggestion: updated };
}
