import { randomUUID } from "node:crypto";
import type {
  AuditRepository,
  EquipmentRepository,
  HotelRepository,
} from "@hotelos/database";
import { DEMO_TENANT_ID } from "@hotelos/database";
import type { HotelId, TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";

/** Stable actor for public equipment webhook ingest (not a login session). */
export const EQUIPMENT_INGEST_ACTOR_USER_ID = Ids.user(
  "00000000-0000-4000-8000-0000000000eq",
);

const ingestSchema = z.object({
  hotelId: z.string().uuid(),
  assetCode: z.string().trim().min(1).max(40),
  signalType: z.enum([
    "runtime_hours",
    "error_code",
    "temp_c",
    "vibration",
    "generic",
  ]),
  valueNum: z.number().optional(),
  valueText: z.string().trim().max(200).optional(),
  recordedAt: z.string().datetime().optional(),
});

export type IngestEquipmentSignalDeps = {
  readonly hotels: HotelRepository;
  readonly equipment: EquipmentRepository;
  readonly audit: AuditRepository;
};

export type IngestEquipmentSignalResult =
  | {
      readonly ok: true;
      readonly signalId: string;
      readonly assetId: string;
      readonly hotelId: string;
    }
  | {
      readonly ok: false;
      readonly code: "HOTEL_NOT_FOUND" | "ASSET_NOT_FOUND" | "INVALID_PAYLOAD";
      readonly message: string;
    };

export async function ingestEquipmentSignal(
  deps: IngestEquipmentSignalDeps,
  input: {
    readonly body: unknown;
    readonly tenantId?: TenantId;
    readonly actorUserId?: UserId;
    readonly publicIngest?: boolean;
  },
): Promise<IngestEquipmentSignalResult> {
  const parsed = ingestSchema.safeParse(input.body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }

  const tenantId = input.tenantId ?? Ids.tenant(DEMO_TENANT_ID);
  const actorUserId = input.actorUserId ?? EQUIPMENT_INGEST_ACTOR_USER_ID;
  const hotelId = Ids.hotel(parsed.data.hotelId);
  const now = new Date().toISOString();
  const recordedAt = parsed.data.recordedAt ?? now;

  const hotel = await deps.hotels.findById(hotelId);
  if (!hotel || hotel.tenantId !== tenantId) {
    return {
      ok: false,
      code: "HOTEL_NOT_FOUND",
      message: "Hotel id from equipment ingest is not in this tenant",
    };
  }

  const asset = await deps.equipment.findAssetByCode(
    tenantId,
    hotelId,
    parsed.data.assetCode,
  );
  if (!asset) {
    return {
      ok: false,
      code: "ASSET_NOT_FOUND",
      message: `Equipment asset code ${parsed.data.assetCode} not found for hotel`,
    };
  }

  const signal = await deps.equipment.createSignal({
    id: randomUUID(),
    assetId: asset.id,
    tenantId,
    hotelId: hotelId,
    signalType: parsed.data.signalType,
    valueNum: parsed.data.valueNum ?? null,
    valueText: parsed.data.valueText ?? null,
    recordedAt,
    source: "webhook",
    createdAt: now,
  });

  await deps.audit.append({
    id: randomUUID(),
    tenantId,
    actorUserId,
    action: "equipment.signal.ingest",
    resourceType: "equipment_signal",
    resourceId: signal.id,
    metadata: {
      hotelId: parsed.data.hotelId,
      assetCode: parsed.data.assetCode,
      signalType: parsed.data.signalType,
      ...(input.publicIngest === true ? { publicIngest: true } : {}),
    },
    createdAt: now,
  });

  return {
    ok: true,
    signalId: signal.id,
    assetId: asset.id,
    hotelId: parsed.data.hotelId,
  };
}
