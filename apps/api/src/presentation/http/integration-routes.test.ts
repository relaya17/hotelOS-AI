import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createJwtTokenService } from "@hotelos/auth";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type AuditRepository,
  type HotelRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { createIntegrationRoutes } from "./integration-routes.js";

const tokens = createJwtTokenService({
  accessSecret: "test-access-secret",
  refreshSecret: "test-refresh-secret",
  accessTtlSeconds: 900,
  refreshTtlSeconds: 86_400,
});

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const tlvHotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);

function createIntegrationDeps(overrides?: {
  readonly setEnabled?: HotelRepository["setEnabledIntegrationDomains"];
}) {
  const auditRows: Array<{ action: string }> = [];
  return {
    deps: {
      pmsProvider: "demo",
      mewsConfigured: false,
      tokens,
      hotels: {
        getEnabledIntegrationDomains: async () => ["pms", "reputation"],
        setEnabledIntegrationDomains:
          overrides?.setEnabled ??
          (async () => ({
            id: tlvHotelId,
            tenantId,
            chainId: "chain-demo",
            name: "TLV Demo",
            timezone: "Asia/Jerusalem",
            currency: "ILS",
            kashrutEnabled: false,
            enabledIntegrationDomains: ["pms"],
          })),
      } as unknown as HotelRepository,
      audit: {
        append: async (event: { action: string }) => {
          auditRows.push({ action: event.action });
        },
      } as unknown as AuditRepository,
    },
    auditRows,
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

describe("integration routes", () => {
  it("returns enabledForHotel when hotelId query is provided", async () => {
    const { deps } = createIntegrationDeps();
    const app = createIntegrationRoutes(deps);
    const token = await issueToken(DEMO_HOTEL_TLV_ID);

    const response = await app.request(
      `/catalog?hotelId=${DEMO_HOTEL_TLV_ID}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: { enabledForHotel?: string[] };
    };
    assert.deepEqual(body.data.enabledForHotel, ["pms", "reputation"]);
  });

  it("rejects unknown integration domain ids on PUT", async () => {
    const { deps } = createIntegrationDeps();
    const app = createIntegrationRoutes(deps);
    const token = await issueToken(DEMO_HOTEL_TLV_ID);

    const response = await app.request(
      `/hotels/${DEMO_HOTEL_TLV_ID}/domains`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: ["pms", "not_a_real_domain"] }),
      },
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "INVALID_INTEGRATION_DOMAIN");
  });

  it("rejects deferred domain ids on PUT", async () => {
    const { deps } = createIntegrationDeps();
    const app = createIntegrationRoutes(deps);
    const token = await issueToken(DEMO_HOTEL_TLV_ID);

    const response = await app.request(
      `/hotels/${DEMO_HOTEL_TLV_ID}/domains`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: ["access"] }),
      },
    );

    assert.equal(response.status, 400);
    const body = (await response.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "INVALID_INTEGRATION_DOMAIN");
  });
});
