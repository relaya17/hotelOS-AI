import type {
  BookingRepository,
  MaintenanceRepository,
  OverviewRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import {
  countOccupiedRoomsOnNight,
  projectedOccupancyPct,
  REVENUE_HIGH_OCCUPANCY_PCT,
} from "./suggest-revenue-rates.js";

export type OpsForecastDay = {
  readonly date: string;
  readonly arrivalsCount: number;
  readonly departuresCount: number;
  readonly occupancyEstimatePct: number;
  readonly openMaintenanceCount: number;
  readonly staffingHintHe: string;
};

export type OpsForecast = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly generatedAt: string;
  readonly days: readonly OpsForecastDay[];
  readonly summaryBulletsHe: readonly string[];
};

export type BuildOpsForecastDeps = {
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly maintenance: MaintenanceRepository;
};

export type BuildOpsForecastInput = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly horizonDays?: number;
  readonly now?: Date;
};

const FORECAST_DAYS_DEFAULT = 7;

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

function staffingHintForOccupancy(occupancyPct: number): string {
  if (occupancyPct >= REVENUE_HIGH_OCCUPANCY_PCT) {
    return "תפוסה גבוהה — לשקול משמרת נוספת במשק בית ותמיכה בקבלה.";
  }
  if (occupancyPct >= 60) {
    return "עומס בינוני — לוודא כיסוי משמרות משק בית לפי לוח הגעות.";
  }
  return "עומס רגיל — כיסוי משמרות סטנדרטי.";
}

export async function buildOpsForecast(
  deps: BuildOpsForecastDeps,
  input: BuildOpsForecastInput,
): Promise<OpsForecast | null> {
  const chain = await deps.overview.getChainOverview(input.tenantId);
  if (!chain) {
    return null;
  }

  const hotel = chain.hotels.find((row) => row.id === input.hotelId);
  if (!hotel) {
    return null;
  }

  const horizonDays = input.horizonDays ?? FORECAST_DAYS_DEFAULT;
  const now = input.now ?? new Date();
  const bookings = await deps.bookings.listByHotel(
    input.tenantId,
    input.hotelId,
  );
  const activeBookings = bookings.filter((booking) =>
    isActiveBooking(booking.status),
  );

  const maintenance = await deps.maintenance.listByHotel(
    input.tenantId,
    input.hotelId,
  );
  const openMaintenanceCount = maintenance.filter(
    (request) => request.status !== "done" && request.status !== "cancelled",
  ).length;

  const days: OpsForecastDay[] = [];
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = formatDateUtc(addDaysUtc(now, offset));
    const occupied = countOccupiedRoomsOnNight(activeBookings, date);
    const occupancyEstimatePct = projectedOccupancyPct(
      occupied,
      hotel.rooms.total,
    );
    const arrivalsCount = activeBookings.filter(
      (booking) => booking.checkInDate === date,
    ).length;
    const departuresCount = activeBookings.filter(
      (booking) => booking.checkOutDate === date,
    ).length;

    days.push({
      date,
      arrivalsCount,
      departuresCount,
      occupancyEstimatePct,
      openMaintenanceCount,
      staffingHintHe: staffingHintForOccupancy(occupancyEstimatePct),
    });
  }

  const peakDay = days.reduce(
    (best, day) =>
      day.occupancyEstimatePct > best.occupancyEstimatePct ? day : best,
    days[0]!,
  );
  const totalArrivals = days.reduce((sum, day) => sum + day.arrivalsCount, 0);
  const totalDepartures = days.reduce(
    (sum, day) => sum + day.departuresCount,
    0,
  );

  const summaryBulletsHe: string[] = [
    `${horizonDays} ימים קדימה: ${totalArrivals} הגעות, ${totalDepartures} יציאות.`,
    `שיא תפוסה משוער: ${peakDay.occupancyEstimatePct}% (${peakDay.date}).`,
    `${openMaintenanceCount} קריאות תחזוקה פתוחות — ${openMaintenanceCount > 0 ? "לתאם לפני ימי עומס." : "אין חסימות תחזוקה."}`,
    peakDay.staffingHintHe,
  ];

  return {
    hotelId: hotel.id,
    hotelName: hotel.name,
    generatedAt: now.toISOString(),
    days,
    summaryBulletsHe,
  };
}

/** Compact bullets for CIO digest sections. */
export function forecastBulletsHe(forecast: OpsForecast): readonly string[] {
  return [
    `תחזית ${forecast.days.length} ימים: ${forecast.summaryBulletsHe[0] ?? ""}`,
    forecast.summaryBulletsHe[1] ?? "",
    forecast.summaryBulletsHe[3] ?? "",
  ].filter((line) => line.length > 0);
}
