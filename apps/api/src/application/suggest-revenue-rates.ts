import { randomUUID } from "node:crypto";
import type {
  BookingRepository,
  CreateRevenueSuggestionInput,
  OverviewRepository,
  PersistedRevenueSuggestion,
  RevenueSuggestionsRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

/** Occupancy at or above this % triggers upward rate suggestions. */
export const REVENUE_HIGH_OCCUPANCY_PCT = 80;

/** Occupancy below this % triggers promotional downward suggestions. */
export const REVENUE_LOW_OCCUPANCY_PCT = 30;

export const REVENUE_INCREASE_MIN_PCT = 5;
export const REVENUE_INCREASE_MAX_PCT = 12;
export const REVENUE_PROMO_DECREASE_PCT = -5;

/** Static season/event calendar — applied after occupancy delta (no PMS/LLM). */
export type SeasonEventRule = {
  readonly labelHe: string;
  readonly deltaPct: number;
  readonly monthDays?: readonly string[];
  readonly weekdays?: readonly number[];
  readonly monthRange?: readonly [number, number];
};

export const SEASON_EVENT_ADJUSTMENTS: readonly SeasonEventRule[] = [
  {
    labelHe: "סוף שבוע (שישי–שבת)",
    deltaPct: 4,
    weekdays: [5, 6],
  },
  {
    labelHe: "עונת שיא קיץ",
    deltaPct: 3,
    monthRange: [6, 8],
  },
  {
    labelHe: "חג הפסח",
    deltaPct: 6,
    monthDays: ["04-12", "04-13", "04-14", "04-15"],
  },
  {
    labelHe: "ראש השנה",
    deltaPct: 5,
    monthDays: ["09-22", "09-23", "09-24"],
  },
  {
    labelHe: "סוכות",
    deltaPct: 4,
    monthDays: ["10-06", "10-07", "10-08", "10-09"],
  },
  {
    labelHe: "יום העצמאות",
    deltaPct: 5,
    monthDays: ["05-14"],
  },
  {
    labelHe: "חנוכה",
    deltaPct: 3,
    monthDays: ["12-24", "12-25", "12-26"],
  },
];

export type SeasonEventAdjustment = {
  readonly totalDeltaPct: number;
  readonly labelsHe: readonly string[];
};

export function seasonEventAdjustmentForDate(
  nightDate: string,
): SeasonEventAdjustment {
  const weekday = new Date(`${nightDate}T12:00:00.000Z`).getUTCDay();
  const monthDay = nightDate.slice(5);
  const month = Number.parseInt(nightDate.slice(5, 7), 10);

  const labelsHe: string[] = [];
  let totalDeltaPct = 0;

  for (const rule of SEASON_EVENT_ADJUSTMENTS) {
    const matchesWeekday =
      rule.weekdays !== undefined && rule.weekdays.includes(weekday);
    const matchesMonthDay =
      rule.monthDays !== undefined && rule.monthDays.includes(monthDay);
    const matchesMonthRange =
      rule.monthRange !== undefined &&
      month >= rule.monthRange[0] &&
      month <= rule.monthRange[1];

    if (matchesWeekday || matchesMonthDay || matchesMonthRange) {
      totalDeltaPct += rule.deltaPct;
      labelsHe.push(rule.labelHe);
    }
  }

  return { totalDeltaPct, labelsHe };
}

export function applySeasonEventToRateSuggestion(
  base: Pick<RevenueRateSuggestionDraft, "suggestedDeltaPct" | "rationaleHe">,
  nightDate: string,
): Pick<RevenueRateSuggestionDraft, "suggestedDeltaPct" | "rationaleHe"> {
  const season = seasonEventAdjustmentForDate(nightDate);
  if (season.labelsHe.length === 0) {
    return base;
  }

  const suggestedDeltaPct = base.suggestedDeltaPct + season.totalDeltaPct;
  const sign =
    season.totalDeltaPct >= 0 ? `+${season.totalDeltaPct}` : `${season.totalDeltaPct}`;
  const rationaleHe = `${base.rationaleHe} · לוח עונות/אירועים: ${season.labelsHe.join(", ")} (${sign}%).`;

  return { suggestedDeltaPct, rationaleHe };
}

export type RevenueRateSuggestionDraft = {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currentOccupancyPct: number;
  readonly suggestedDeltaPct: number;
  readonly rationaleHe: string;
};

export type SuggestRevenueRatesInput = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  /** Forecast horizon in days (7–14). Defaults to 7. */
  readonly horizonDays?: number;
  readonly now?: Date;
};

export type SuggestRevenueRatesDeps = {
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly revenueSuggestions: RevenueSuggestionsRepository;
};

export type SuggestRevenueRatesResult = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly generatedAt: string;
  readonly horizonDays: number;
  readonly suggestions: readonly PersistedRevenueSuggestion[];
};

function formatDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysUtc(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isActiveBooking(status: string): boolean {
  return status === "confirmed" || status === "checked_in";
}

/** Night-stay overlap: check-in ≤ date < check-out (date-only strings). */
export function bookingOccupiesNight(
  checkInDate: string,
  checkOutDate: string,
  nightDate: string,
): boolean {
  return checkInDate <= nightDate && nightDate < checkOutDate;
}

export function countOccupiedRoomsOnNight(
  bookings: readonly {
    readonly checkInDate: string;
    readonly checkOutDate: string;
    readonly status: string;
  }[],
  nightDate: string,
): number {
  return bookings.filter(
    (booking) =>
      isActiveBooking(booking.status) &&
      bookingOccupiesNight(
        booking.checkInDate,
        booking.checkOutDate,
        nightDate,
      ),
  ).length;
}

export function projectedOccupancyPct(
  occupiedRooms: number,
  totalRooms: number,
): number {
  if (totalRooms <= 0) {
    return 0;
  }
  return Math.round((occupiedRooms / totalRooms) * 100);
}

/**
 * Deterministic MVP rules — no LLM, no PMS writeback.
 * High occupancy → +5–12%; low → promo −5%; shoulder → hold (0%).
 */
export function suggestRateDeltaForOccupancy(
  occupancyPct: number,
): Pick<RevenueRateSuggestionDraft, "suggestedDeltaPct" | "rationaleHe"> {
  if (occupancyPct >= REVENUE_HIGH_OCCUPANCY_PCT) {
    const span = 100 - REVENUE_HIGH_OCCUPANCY_PCT;
    const ratio = Math.min(1, (occupancyPct - REVENUE_HIGH_OCCUPANCY_PCT) / span);
    const delta =
      REVENUE_INCREASE_MIN_PCT +
      Math.round(ratio * (REVENUE_INCREASE_MAX_PCT - REVENUE_INCREASE_MIN_PCT));
    return {
      suggestedDeltaPct: delta,
      rationaleHe: `תפוסה גבוהה (${occupancyPct}%) — מומלץ להעלות מחיר ב-${delta}% לניצול ביקוש.`,
    };
  }
  if (occupancyPct < REVENUE_LOW_OCCUPANCY_PCT) {
    return {
      suggestedDeltaPct: REVENUE_PROMO_DECREASE_PCT,
      rationaleHe: `תפוסה נמוכה (${occupancyPct}%) — מומלץ מבצע/הנחה של ${Math.abs(REVENUE_PROMO_DECREASE_PCT)}% לעידוד הזמנות.`,
    };
  }
  return {
    suggestedDeltaPct: 0,
    rationaleHe: `תפוסה בינונית (${occupancyPct}%) — להחזיק מחיר (shoulder season).`,
  };
}

export function buildRevenueRateSuggestionDrafts(
  totalRooms: number,
  bookings: readonly {
    readonly checkInDate: string;
    readonly checkOutDate: string;
    readonly status: string;
  }[],
  horizonDays: number,
  now: Date = new Date(),
): readonly RevenueRateSuggestionDraft[] {
  const days = Math.min(14, Math.max(7, horizonDays));
  const drafts: RevenueRateSuggestionDraft[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const night = formatDateUtc(addDaysUtc(now, offset));
    const occupied = countOccupiedRoomsOnNight(bookings, night);
    const occupancyPct = projectedOccupancyPct(occupied, totalRooms);
    const base = suggestRateDeltaForOccupancy(occupancyPct);
    const { suggestedDeltaPct, rationaleHe } = applySeasonEventToRateSuggestion(
      base,
      night,
    );

    drafts.push({
      periodStart: night,
      periodEnd: night,
      currentOccupancyPct: occupancyPct,
      suggestedDeltaPct,
      rationaleHe,
    });
  }

  return drafts;
}

export async function suggestRevenueRates(
  deps: SuggestRevenueRatesDeps,
  input: SuggestRevenueRatesInput,
): Promise<SuggestRevenueRatesResult | null> {
  const chain = await deps.overview.getChainOverview(input.tenantId);
  if (!chain) {
    return null;
  }

  const hotel = chain.hotels.find((row) => row.id === input.hotelId);
  if (!hotel) {
    return null;
  }

  const horizonDays = input.horizonDays ?? 7;
  const now = input.now ?? new Date();
  const bookings = await deps.bookings.listByHotel(
    input.tenantId,
    input.hotelId,
  );

  const drafts = buildRevenueRateSuggestionDrafts(
    hotel.rooms.total,
    bookings,
    horizonDays,
    now,
  );

  const periodStarts = drafts.map((draft) => draft.periodStart);
  await deps.revenueSuggestions.deleteSuggestedForPeriods(
    input.tenantId,
    input.hotelId,
    periodStarts,
  );

  const createdAt = now.toISOString();
  const toCreate: CreateRevenueSuggestionInput[] = drafts.map((draft) => ({
    id: randomUUID(),
    tenantId: input.tenantId,
    hotelId: input.hotelId,
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    currentOccupancyPct: draft.currentOccupancyPct,
    suggestedDeltaPct: draft.suggestedDeltaPct,
    rationaleHe: draft.rationaleHe,
    createdAt,
  }));

  const suggestions = await deps.revenueSuggestions.createMany(toCreate);

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    generatedAt: createdAt,
    horizonDays: drafts.length,
    suggestions,
  };
}
