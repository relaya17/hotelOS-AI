import { randomUUID } from "node:crypto";
import type {
  EnergyMeterKind,
  EnergyRepository,
  HotelRepository,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export type IngestEnergyReadingInput = {
  readonly hotelId: HotelId;
  readonly meterKind: EnergyMeterKind;
  readonly kwh?: number | null;
  readonly recordedAt: string;
  readonly source: string;
};

export type IngestEnergyReadingResult =
  | {
      readonly ok: true;
      readonly readingId: string;
      readonly tenantId: TenantId;
      readonly hotelId: HotelId;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message: string;
    };

export async function ingestEnergyReading(
  deps: {
    readonly hotels: HotelRepository;
    readonly energy: EnergyRepository;
  },
  input: IngestEnergyReadingInput,
): Promise<IngestEnergyReadingResult> {
  const hotel = await deps.hotels.findById(input.hotelId);
  if (!hotel) {
    return {
      ok: false,
      code: "HOTEL_NOT_FOUND",
      message: "Hotel not found",
    };
  }

  const reading = await deps.energy.createReading({
    id: randomUUID(),
    tenantId: hotel.tenantId,
    hotelId: input.hotelId,
    meterKind: input.meterKind,
    kwh: input.kwh ?? null,
    recordedAt: input.recordedAt,
    source: input.source,
  });

  return {
    ok: true,
    readingId: reading.id,
    tenantId: hotel.tenantId,
    hotelId: input.hotelId,
  };
}
