import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type BookingRepository,
  type EnergyRepository,
  type EquipmentRepository,
  type FeedbackRepository,
  type HotelRepository,
  type MaintenanceRepository,
  type OpsRepository,
  type OverviewRepository,
  type ProcurementRepository,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import {
  buildOpsLiveSnapshot,
  hashOpsLiveSnapshot,
} from "./build-ops-live-snapshot.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);

function createDeps(): Parameters<typeof buildOpsLiveSnapshot>[0] {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
  };

  return {
    hotels: {
      listByTenant: async () => [
        {
          id: hotelId,
          tenantId,
          chainId: "chain-demo",
          name: "TLV Demo",
          timezone: "Asia/Jerusalem",
          currency: "ILS",
          kashrutEnabled: false,
        },
      ],
    } as unknown as HotelRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      findDepartmentByCode: async (
        _t: TenantId,
        _h: HotelId,
        code: string,
      ) =>
        deptIds[code]
          ? {
              id: deptIds[code]!,
              hotelId,
              code,
              name: code,
            }
          : null,
      listTasksByDepartment: async () => [],
      listDepartments: async () => [],
    } as unknown as OpsRepository,
    maintenance: {
      listByHotel: async () => [],
    } as unknown as MaintenanceRepository,
    equipment: {
      listOpenPredictionsByHotel: async () => [],
    } as unknown as EquipmentRepository,
    energy: {
      listSuggestionsByHotel: async () => [],
    } as unknown as EnergyRepository,
    overview: {
      getChainOverview: async () => ({
        tenantId,
        tenantName: "Demo",
        hotelCount: 1,
        hotels: [
          {
            id: hotelId,
            name: "TLV Demo",
            timezone: "Asia/Jerusalem",
            currency: "ILS",
            chainId: "chain-demo",
            rooms: { total: 10, vacant: 5, occupied: 4, dirty: 1, maintenance: 0 },
            bookings: { confirmed: 2, checkedIn: 1, active: 3 },
          },
        ],
      }),
    } as unknown as OverviewRepository,
    bookings: {
      listByHotel: async () => [],
    } as unknown as BookingRepository,
    procurement: {
      listInventory: async () => [],
      listPurchaseOrders: async () => [],
    } as unknown as ProcurementRepository,
    feedback: {
      averageRating: async () => 4.6,
    } as unknown as FeedbackRepository,
  };
}

describe("buildOpsLiveSnapshot", () => {
  it("returns capped incidents, twin overlays, forecast, and briefing hint", async () => {
    const snapshot = await buildOpsLiveSnapshot(createDeps(), tenantId, hotelId);

    assert.equal(snapshot.incidentsSummary.count, 0);
    assert.equal(snapshot.incidentsSummary.topIncidents.length, 0);
    assert.equal(snapshot.twinOverlays.openIncidents.count, 0);
    assert.ok(snapshot.forecastSummary);
    assert.ok(snapshot.briefingHint?.summaryHe.length);
    assert.ok(snapshot.generatedAt.length > 0);
  });

  it("hashOpsLiveSnapshot ignores generatedAt for dedup", async () => {
    const first = await buildOpsLiveSnapshot(createDeps(), tenantId, hotelId);
    const second = {
      ...first,
      generatedAt: "2099-01-01T00:00:00.000Z",
      twinOverlays: {
        ...first.twinOverlays,
        generatedAt: "2099-01-01T00:00:00.000Z",
      },
    };

    assert.equal(hashOpsLiveSnapshot(first), hashOpsLiveSnapshot(second));
  });
});
