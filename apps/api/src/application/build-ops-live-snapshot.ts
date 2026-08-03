import { createHash } from "node:crypto";
import type {
  BookingRepository,
  EnergyRepository,
  EquipmentRepository,
  FeedbackRepository,
  HotelRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";
import { buildDailyBriefing } from "./build-daily-briefing.js";
import {
  buildIncidentCenter,
  type IncidentDto,
} from "./build-incident-center.js";
import { buildOpsForecast } from "./build-ops-forecast.js";
import { buildTwinOverlays, type HotelTwinOverlays } from "./build-twin-overlays.js";

export const OPS_LIVE_TOP_INCIDENTS = 8;
export const OPS_LIVE_BRIEFING_HINT_LINES = 3;
export const OPS_LIVE_FORECAST_HORIZON_DAYS = 3;

export type OpsLiveIncidentsSummary = {
  readonly count: number;
  readonly topIncidents: readonly IncidentDto[];
};

export type OpsLiveForecastSummary = {
  readonly summaryBulletsHe: readonly string[];
  readonly peakOccupancyPct: number;
  readonly peakDate: string;
};

export type OpsLiveBriefingHint = {
  readonly summaryHe: string;
  readonly highlights: readonly string[];
  readonly warnings: readonly string[];
};

export type OpsLiveSnapshot = {
  readonly generatedAt: string;
  readonly incidentsSummary: OpsLiveIncidentsSummary;
  readonly twinOverlays: HotelTwinOverlays;
  readonly forecastSummary?: OpsLiveForecastSummary;
  readonly briefingHint?: OpsLiveBriefingHint;
};

export type BuildOpsLiveSnapshotDeps = {
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly hotels: HotelRepository;
  readonly equipment: EquipmentRepository;
  readonly energy: EnergyRepository;
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
};

function capLines(lines: readonly string[], limit: number): readonly string[] {
  return lines.slice(0, limit);
}

/** Stable content hash for SSE dedup — ignores volatile `generatedAt` timestamps. */
export function hashOpsLiveSnapshot(snapshot: OpsLiveSnapshot): string {
  const stable = {
    incidentsSummary: snapshot.incidentsSummary,
    twinOverlays: {
      openIncidents: snapshot.twinOverlays.openIncidents,
      predictiveAlerts: snapshot.twinOverlays.predictiveAlerts,
      energyHints: snapshot.twinOverlays.energyHints,
    },
    forecastSummary: snapshot.forecastSummary,
    briefingHint: snapshot.briefingHint,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

/**
 * Compact live ops picture for Executive dashboard SSE — reuses existing
 * builders with explicit caps; no secrets or full PII payloads.
 */
export async function buildOpsLiveSnapshot(
  deps: BuildOpsLiveSnapshotDeps,
  tenantId: TenantId,
  hotelId: HotelId,
): Promise<OpsLiveSnapshot> {
  const [incidentCenter, twinOverlays, forecast, briefing] = await Promise.all([
    buildIncidentCenter(
      {
        ops: deps.ops,
        maintenance: deps.maintenance,
        hotels: deps.hotels,
      },
      tenantId,
      [hotelId],
    ),
    buildTwinOverlays(
      {
        ops: deps.ops,
        maintenance: deps.maintenance,
        hotels: deps.hotels,
        equipment: deps.equipment,
        energy: deps.energy,
      },
      tenantId,
      hotelId,
    ),
    buildOpsForecast(
      {
        overview: deps.overview,
        bookings: deps.bookings,
        maintenance: deps.maintenance,
      },
      {
        tenantId,
        hotelId,
        horizonDays: OPS_LIVE_FORECAST_HORIZON_DAYS,
      },
    ),
    buildDailyBriefing(
      {
        overview: deps.overview,
        ops: deps.ops,
        maintenance: deps.maintenance,
        procurement: deps.procurement,
        feedback: deps.feedback,
      },
      tenantId,
      [hotelId],
    ),
  ]);

  const incidentsSummary: OpsLiveIncidentsSummary = {
    count: incidentCenter.incidents.length,
    topIncidents: incidentCenter.incidents.slice(0, OPS_LIVE_TOP_INCIDENTS),
  };

  let forecastSummary: OpsLiveForecastSummary | undefined;
  if (forecast) {
    const peakDay = forecast.days.reduce(
      (best, day) =>
        day.occupancyEstimatePct > best.occupancyEstimatePct ? day : best,
      forecast.days[0]!,
    );
    forecastSummary = {
      summaryBulletsHe: capLines(forecast.summaryBulletsHe, 4),
      peakOccupancyPct: peakDay.occupancyEstimatePct,
      peakDate: peakDay.date,
    };
  }

  let briefingHint: OpsLiveBriefingHint | undefined;
  const hotelSection = briefing?.hotels.find((hotel) => hotel.hotelId === hotelId);
  if (hotelSection) {
    briefingHint = {
      summaryHe: hotelSection.summaryHe,
      highlights: capLines(hotelSection.highlights, OPS_LIVE_BRIEFING_HINT_LINES),
      warnings: capLines(hotelSection.warnings, OPS_LIVE_BRIEFING_HINT_LINES),
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    incidentsSummary,
    twinOverlays,
    ...(forecastSummary !== undefined ? { forecastSummary } : {}),
    ...(briefingHint !== undefined ? { briefingHint } : {}),
  };
}
