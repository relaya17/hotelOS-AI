import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type BookingRepository,
  type EquipmentRepository,
  type GuestProfileRepository,
  type HotelRepository,
  type MaintenanceRepository,
  type OpsRepository,
  type PersistedBooking,
  type PersistedEquipmentAsset,
  type PersistedHotel,
  type PersistedMaintenancePrediction,
  type PersistedRoom,
  type RoomRepository,
} from "@hotelos/database";
import { Ids, type BookingId, type HotelId, type RoomId, type TenantId } from "@hotelos/shared";
import {
  buildOpsKnowledgeGraph,
  OPS_KG_MAX_EDGES,
  OPS_KG_MAX_NODES,
} from "./build-ops-knowledge-graph.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
const roomId = Ids.room("55555555-5555-4555-8555-555555555555");
const bookingId = Ids.booking("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");

const demoHotel: PersistedHotel = {
  id: hotelId,
  tenantId,
  chainId: "chain-demo",
  name: "TLV Demo",
  timezone: "Asia/Jerusalem",
  currency: "ILS",
  kashrutEnabled: false,
};

const demoRoom: PersistedRoom = {
  id: roomId,
  tenantId,
  hotelId,
  number: "402",
  floor: "4",
  roomType: "deluxe",
  status: "occupied",
};

const demoBooking: PersistedBooking = {
  id: bookingId,
  tenantId,
  hotelId,
  roomId,
  guestName: "נועה כהן",
  guestEmail: "noa@example.com",
  guestPhone: null,
  checkInDate: "2026-08-10",
  checkOutDate: "2026-08-12",
  status: "confirmed",
  roomPrepStatus: null,
  roomNumber: "402",
};

function prediction(
  overrides: Partial<PersistedMaintenancePrediction> & { readonly id: string },
): PersistedMaintenancePrediction {
  return {
    tenantId,
    hotelId,
    assetId: "asset-hvac-1",
    riskScore: 70,
    rationaleHe: "חריגה ב-HVAC",
    recommendedActionHe: "בדיקת מסנן",
    status: "open",
    taskId: "task-pm-1",
    createdAt: "2026-08-03T10:00:00.000Z",
    ...overrides,
  };
}

function asset(
  overrides: Partial<PersistedEquipmentAsset> & { readonly id: string },
): PersistedEquipmentAsset {
  return {
    tenantId,
    hotelId,
    code: "HVAC-01",
    nameHe: "מיזוג אוויר לובי",
    category: "hvac",
    locationHe: "לובי",
    installDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createDeps(input?: {
  readonly hotel?: PersistedHotel | null;
}): Parameters<typeof buildOpsKnowledgeGraph>[0] {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
  };

  return {
    hotels: {
      findById: async () => input?.hotel ?? demoHotel,
      listByTenant: async () => [demoHotel],
    } as unknown as HotelRepository,
    rooms: {
      listByHotel: async () => [demoRoom],
    } as unknown as RoomRepository,
    bookings: {
      listByHotel: async () => [demoBooking],
    } as unknown as BookingRepository,
    guestProfiles: {
      findByEmail: async (_t: TenantId, email: string) =>
        email === "noa@example.com"
          ? {
              id: "profile-1",
              tenantId,
              email: "noa@example.com",
              displayName: "נועה כהן",
              phone: null,
              notesHe: null,
              preferencesJson: "{}",
              stayCount: 2,
              lastHotelId: hotelId,
              lastStayAt: "2026-07-01",
              marketingConsent: true,
              createdAt: "2026-01-01",
              updatedAt: "2026-07-01",
            }
          : null,
      rememberStay: async () => {
        throw new Error("not used");
      },
      listRecent: async () => [],
      countByTenant: async () => 0,
    } as unknown as GuestProfileRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      findDepartmentByCode: async (
        _t: TenantId,
        _h: HotelId,
        code: string,
      ) =>
        deptIds[code]
          ? { id: deptIds[code]!, hotelId, code, name: code }
          : null,
      listTasksByDepartment: async (
        _t: TenantId,
        _h: HotelId,
        departmentId: string,
      ) =>
        departmentId === deptIds["it"]
          ? [
              {
                id: "task-it-1",
                tenantId,
                hotelId,
                departmentId,
                taskType: "error_event",
                title: "שגיאת מערכת PMS",
                description: "timeout",
                priority: "high",
                status: "open",
                assignedToUserId: null,
                dueAt: null,
                createdAt: "2026-08-03T08:00:00.000Z",
                updatedAt: "2026-08-03T08:00:00.000Z",
              },
            ]
          : [],
    } as unknown as OpsRepository,
    maintenance: {
      listByHotel: async () => [],
    } as unknown as MaintenanceRepository,
    equipment: {
      listOpenPredictionsByHotel: async () => [
        prediction({ id: "pm-1", assetId: "asset-hvac-1" }),
      ],
      listAssetsByHotel: async () => [asset({ id: "asset-hvac-1" })],
    } as unknown as EquipmentRepository,
  };
}

describe("buildOpsKnowledgeGraph", () => {
  it("assembles hotel, rooms, bookings, guests, incidents, and equipment edges", async () => {
    const graph = await buildOpsKnowledgeGraph(createDeps(), {
      tenantId,
      hotelId,
    });

    assert.ok(graph);
    assert.ok(graph!.generatedAt.length > 0);
    assert.ok(graph!.nodes.length <= OPS_KG_MAX_NODES);
    assert.ok(graph!.edges.length <= OPS_KG_MAX_EDGES);

    const types = new Set(graph!.nodes.map((node) => node.type));
    assert.ok(types.has("hotel"));
    assert.ok(types.has("room"));
    assert.ok(types.has("booking"));
    assert.ok(types.has("guest"));
    assert.ok(types.has("incident"));
    assert.ok(types.has("equipment"));
    assert.ok(types.has("prediction"));

    const edgeTypes = new Set(graph!.edges.map((edge) => edge.type));
    assert.ok(edgeTypes.has("has_room"));
    assert.ok(edgeTypes.has("has_booking"));
    assert.ok(edgeTypes.has("booked_by"));
    assert.ok(edgeTypes.has("open_incident"));
    assert.ok(edgeTypes.has("predicts_on"));

    const guestNode = graph!.nodes.find((node) => node.type === "guest");
    assert.equal(guestNode?.meta?.["profileName"], "נועה כהן");
  });

  it("returns null when hotel is outside tenant", async () => {
    const graph = await buildOpsKnowledgeGraph(
      createDeps({
        hotel: {
          ...demoHotel,
          tenantId: Ids.tenant("99999999-9999-4999-8999-999999999999"),
        },
      }),
      { tenantId, hotelId },
    );

    assert.equal(graph, null);
  });
});
