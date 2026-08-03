import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJwtTokenService } from "@hotelos/auth";
import {
  DEMO_HOTEL_EILAT_ID,
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
import { Ids } from "@hotelos/shared";
import {
  createStreamRoutes,
} from "./stream-routes.js";
import { SSE_STREAM_PATH_PREFIX } from "./rate-limit.js";

const tokens = createJwtTokenService({
  accessSecret: "test-access-secret",
  refreshSecret: "test-refresh-secret",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 86_400,
});

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const tlvHotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);

const demoHotels = [
  {
    id: tlvHotelId,
    tenantId,
    chainId: "chain-demo",
    name: "TLV Demo",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    kashrutEnabled: false,
  },
];

function createStreamDeps() {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
  };

  return {
    tokens,
    hotels: {
      listByTenant: async () => demoHotels,
    } as unknown as HotelRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      findDepartmentByCode: async (_t: unknown, _h: unknown, code: string) =>
        deptIds[code]
          ? {
              id: deptIds[code]!,
              hotelId: tlvHotelId,
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
      listAssetsByHotel: async () => [],
      listSignalsByAsset: async () => [],
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
            id: tlvHotelId,
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

async function issueToken(hotelId?: string): Promise<string> {
  const pair = await tokens.issuePair({
    userId: Ids.user("22222222-2222-4222-8222-222222222222"),
    roles: ["owner"],
    scope: {
      tenantId,
      ...(hotelId !== undefined ? { hotelId: Ids.hotel(hotelId) } : {}),
    },
  });
  return pair.accessToken;
}

describe("stream routes ACL", () => {
  it("requires bearer authorization", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const res = await app.request(
      `/ops-dashboard?hotelId=${DEMO_HOTEL_TLV_ID}`,
    );
    assert.equal(res.status, 401);
  });

  it("rejects missing hotelId", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const token = await issueToken();
    const res = await app.request("/ops-dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 400);
  });

  it("rejects invalid hotelId", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const token = await issueToken();
    const res = await app.request("/ops-dashboard?hotelId=not-a-uuid", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 400);
  });

  it("rejects hotel outside tenant", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const token = await issueToken();
    const res = await app.request(
      `/ops-dashboard?hotelId=${DEMO_HOTEL_EILAT_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 404);
  });

  it("rejects hotel outside principal scope", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const token = await issueToken(DEMO_HOTEL_EILAT_ID);
    const res = await app.request(
      `/ops-dashboard?hotelId=${DEMO_HOTEL_TLV_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    assert.equal(res.status, 403);
  });

  it("opens SSE with an initial snapshot for authorized hotel", async () => {
    const app = createStreamRoutes(createStreamDeps());
    const token = await issueToken(DEMO_HOTEL_TLV_ID);
    const abort = new AbortController();

    const res = await app.request(
      `/ops-dashboard?hotelId=${DEMO_HOTEL_TLV_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: abort.signal,
      },
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);

    const reader = res.body?.getReader();
    assert.ok(reader);
    const first = await reader.read();
    const chunk = new TextDecoder().decode(first.value);
    assert.match(chunk, /event: snapshot/);
    abort.abort();
    await reader.cancel();
  });
});

describe("SSE stream path prefix", () => {
  it("uses dedicated stream path prefix", () => {
    assert.equal(SSE_STREAM_PATH_PREFIX, "/v1/streams/");
  });
});
