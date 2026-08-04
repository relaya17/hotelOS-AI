import { authPost } from "./core.js";

export type RevenueSimulationDto = {
  readonly hotelId: string;
  readonly hotelName: string;
  readonly currency: string;
  readonly roomsTotal: number;
  readonly elasticity: number;
  readonly assumptionsHe: readonly string[];
  readonly risksHe: readonly string[];
  readonly baseline: {
    readonly labelHe: string;
    readonly adr: number;
    readonly occupancyPct: number;
    readonly revpar: number;
    readonly estimatedRoomRevenue: number;
  };
  readonly proposed: {
    readonly labelHe: string;
    readonly adr: number;
    readonly occupancyPct: number;
    readonly revpar: number;
    readonly estimatedRoomRevenue: number;
  };
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

export type RevenueSimulatorRunDto = {
  readonly simulation: RevenueSimulationDto;
  readonly narrativeHe: string;
  readonly approvalId?: string;
};

export async function runRevenueSimulator(input: {
  readonly hotelId: string;
  readonly adrChangePercent: number;
  readonly baseAdr?: number;
  readonly nights?: number;
  readonly requestApproval?: boolean;
}): Promise<RevenueSimulatorRunDto> {
  const payload = (await authPost("/v1/simulator/revenue/run", input)) as {
    data: RevenueSimulatorRunDto;
  };
  return payload.data;
}
