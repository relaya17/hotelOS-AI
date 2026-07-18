import type { OverviewRepository } from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

/** Documented MVP elasticity: +1% ADR ≈ −0.8% occupancy demand (rule-based). */
export const REVENUE_PRICE_ELASTICITY = -0.8;

/** ADR change ≥ this % requires human approval before any Act (revenue-agent.md). */
export const REVENUE_APPROVAL_ADR_THRESHOLD_PCT = 5;

export type RevenueSimulatorInput = {
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  /** Proposed ADR change, e.g. 15 = +15%. */
  readonly adrChangePercent: number;
  /** Assumed base ADR (₪) when ledger ADR is not yet wired. */
  readonly baseAdr: number;
  readonly nights: number;
};

export type RevenueSimulatorScenario = {
  readonly labelHe: string;
  readonly adr: number;
  readonly occupancyPct: number;
  readonly revpar: number;
  readonly estimatedRoomRevenue: number;
};

export type RevenueSimulatorResult = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly currency: string;
  readonly roomsTotal: number;
  readonly elasticity: number;
  readonly assumptionsHe: readonly string[];
  readonly risksHe: readonly string[];
  readonly baseline: RevenueSimulatorScenario;
  readonly proposed: RevenueSimulatorScenario;
  readonly delta: {
    readonly adrPct: number;
    readonly occupancyPts: number;
    readonly revparPct: number;
    readonly revenuePct: number;
  };
  readonly requiresHumanApproval: boolean;
  readonly approvalReasonHe: string | null;
  readonly executesChange: false;
};

export async function runRevenueSimulator(
  overview: OverviewRepository,
  input: RevenueSimulatorInput,
): Promise<RevenueSimulatorResult | null> {
  const chain = await overview.getChainOverview(input.tenantId);
  if (!chain) return null;
  const hotel = chain.hotels.find((h) => h.id === input.hotelId);
  if (!hotel) return null;

  const roomsTotal = Math.max(hotel.rooms.total, 1);
  const baseOcc =
    hotel.rooms.total === 0
      ? 0
      : hotel.rooms.occupied / hotel.rooms.total;
  const adrChange = input.adrChangePercent / 100;
  const proposedAdr = round2(input.baseAdr * (1 + adrChange));
  const occDelta = adrChange * REVENUE_PRICE_ELASTICITY;
  const proposedOcc = clamp(baseOcc * (1 + occDelta), 0.05, 0.98);
  const nights = Math.max(1, Math.min(input.nights, 30));

  const baseline = scenario("בסיס (מצב נוכחי)", input.baseAdr, baseOcc, roomsTotal, nights);
  const proposed = scenario(
    "מוצע (סימולציה בלבד)",
    proposedAdr,
    proposedOcc,
    roomsTotal,
    nights,
  );

  const requiresHumanApproval =
    Math.abs(input.adrChangePercent) >= REVENUE_APPROVAL_ADR_THRESHOLD_PCT;

  const risksHe: string[] = [];
  if (proposed.occupancyPct < baseline.occupancyPct) {
    risksHe.push("תפוסה צפויה לרדת בעקבות עליית מחיר (אלסטיות ביקוש).");
  }
  if (input.adrChangePercent > 0) {
    risksHe.push("ADR↑ עלול להגביר ביטולים/הסטה למתחרים — לא ממודל כאן במלואו.");
  }
  if (input.adrChangePercent < 0) {
    risksHe.push("הנחה עלולה לפגוע ב-ADR בלי הבטחת עליית תפוסה מלאה.");
  }

  return {
    hotelId: String(hotel.id),
    hotelName: hotel.name,
    currency: hotel.currency,
    roomsTotal,
    elasticity: REVENUE_PRICE_ELASTICITY,
    assumptionsHe: [
      `ADR בסיס משוער: ${input.baseAdr} ${hotel.currency} (עד חיבור ADR מחשבונות).`,
      `אלסטיות מחיר→תפוסה: ${REVENUE_PRICE_ELASTICITY} (MVP rule-based, לא ML).`,
      `אופק: ${nights} לילות · חדרים במלון: ${roomsTotal}.`,
      "הסימולציה אינה מבצעת שינוי מחיר במערכת/PMS.",
    ],
    risksHe,
    baseline,
    proposed,
    delta: {
      adrPct: round2(input.adrChangePercent),
      occupancyPts: round2(proposed.occupancyPct - baseline.occupancyPct),
      revparPct: pctChange(baseline.revpar, proposed.revpar),
      revenuePct: pctChange(
        baseline.estimatedRoomRevenue,
        proposed.estimatedRoomRevenue,
      ),
    },
    requiresHumanApproval,
    approvalReasonHe: requiresHumanApproval
      ? `שינוי ADR של ${round2(input.adrChangePercent)}% ≥ סף ${REVENUE_APPROVAL_ADR_THRESHOLD_PCT}% — נדרש אישור אנושי לפני Act.`
      : null,
    executesChange: false,
  };
}

function scenario(
  labelHe: string,
  adr: number,
  occupancy: number,
  roomsTotal: number,
  nights: number,
): RevenueSimulatorScenario {
  const occupancyPct = round2(occupancy * 100);
  const revpar = round2(adr * occupancy);
  const estimatedRoomRevenue = round2(revpar * roomsTotal * nights);
  return {
    labelHe,
    adr: round2(adr),
    occupancyPct,
    revpar,
    estimatedRoomRevenue,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function pctChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return round2(((to - from) / from) * 100);
}
