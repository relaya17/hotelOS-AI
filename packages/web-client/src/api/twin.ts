import { authGet, authPost } from "./core.js";

export type HotelTwinDto = {
  readonly hotelId: string;
  readonly generatedAt: string;
  readonly rooms: readonly {
    readonly roomNumber: string;
    readonly status: string;
    readonly source: string;
    readonly floor?: string;
    readonly roomId?: string;
  }[];
  readonly pms?: {
    readonly providerId: string;
    readonly externalHotelId: string;
    readonly fetchedAt: string;
    readonly reservationCount: number;
    readonly reservations: readonly {
      readonly externalReservationId: string;
      readonly roomNumber: string | null;
      readonly checkInDate: string;
      readonly checkOutDate: string;
      readonly status: string;
    }[];
  };
  readonly overlays?: HotelTwinOverlaysDto;
  readonly equipment: readonly TwinEquipmentNodeDto[];
};

export type TwinEquipmentNodeDto = {
  readonly assetId: string;
  readonly assetCode: string;
  readonly nameHe: string;
  readonly category: "hvac" | "elevator" | "boiler" | "other";
  readonly locationHe: string;
  readonly health: "critical" | "warning" | "ok";
  readonly openPrediction?: {
    readonly id: string;
    readonly riskScore: number;
    readonly rationaleHe: string;
    readonly status: string;
  };
  readonly latestSignals: readonly {
    readonly id: string;
    readonly signalType: string;
    readonly valueNum: number | null;
    readonly valueText: string | null;
    readonly recordedAt: string;
  }[];
};

export type HotelTwinOverlayItemDto = {
  readonly id: string;
  readonly title: string;
  readonly severity?: string;
  readonly department?: string;
  readonly riskScore?: number;
  readonly estimatedSavingPct?: number;
  readonly status?: string;
  readonly assetId?: string;
  readonly assetCode?: string;
};

export type HotelTwinOverlaySummaryDto = {
  readonly count: number;
  readonly topItems: readonly HotelTwinOverlayItemDto[];
};

export type HotelTwinEquipmentSummaryDto = {
  readonly count: number;
  readonly byCategory: Readonly<
    Record<"hvac" | "elevator" | "boiler" | "other", number>
  >;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly topItems: readonly {
    readonly assetId: string;
    readonly assetCode: string;
    readonly nameHe: string;
    readonly category: "hvac" | "elevator" | "boiler" | "other";
    readonly health: "critical" | "warning" | "ok";
    readonly riskScore?: number;
  }[];
};

export type HotelTwinOverlaysDto = {
  readonly generatedAt: string;
  readonly openIncidents: HotelTwinOverlaySummaryDto;
  readonly predictiveAlerts: HotelTwinOverlaySummaryDto;
  readonly energyHints: HotelTwinOverlaySummaryDto;
  readonly equipmentSummary: HotelTwinEquipmentSummaryDto;
};

export async function fetchHotelTwin(hotelId: string): Promise<HotelTwinDto> {
  const payload = (await authGet(`/v1/twin/hotels/${hotelId}`)) as {
    data: HotelTwinDto;
  };
  return payload.data;
}

export async function syncHotelTwinPms(hotelId: string): Promise<{
  readonly twin: HotelTwinDto;
  readonly sync: { readonly noteHe: string; readonly providerId: string };
}> {
  const payload = (await authPost(
    `/v1/twin/hotels/${hotelId}/pms-sync`,
    {},
  )) as {
    data: {
      twin: HotelTwinDto;
      sync: { noteHe: string; providerId: string };
    };
  };
  return payload.data;
}
