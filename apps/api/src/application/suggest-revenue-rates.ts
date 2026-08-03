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
    const { suggestedDeltaPct, rationaleHe } =
      suggestRateDeltaForOccupancy(occupancyPct);

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
