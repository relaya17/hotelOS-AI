import type { Page, Route } from "@playwright/test";

export const AXE_STUB_TENANT_ID = "11111111-1111-4111-8111-111111111111";
export const AXE_STUB_HOTEL_ID = "22222222-2222-4222-8222-222222222222";
export const AXE_STUB_CHAIN_ID = "33333333-3333-4333-8333-333333333333";
export const AXE_STUB_USER_ID = "44444444-4444-4444-8444-444444444444";

const STUB_HOTEL = {
  id: AXE_STUB_HOTEL_ID,
  name: "Demo Hotel Axe",
  timezone: "Asia/Jerusalem",
  currency: "USD",
  chainId: AXE_STUB_CHAIN_ID,
  kashrutEnabled: false,
};

const STUB_ME = {
  id: AXE_STUB_USER_ID,
  email: "admin@demo.hotelos.local",
  displayName: "Axe Demo",
  roles: ["admin", "gm"],
  scope: {
    tenantId: AXE_STUB_TENANT_ID,
    hotelId: AXE_STUB_HOTEL_ID,
  },
};

const STUB_APPROVAL = {
  id: "55555555-5555-4555-8555-555555555555",
  hotelId: AXE_STUB_HOTEL_ID,
  agentId: "ops.housekeeping",
  summaryHe: "ניקוי דחוף לחדר 412",
  reasonHe: "צ׳ק־אין בעוד שעתיים",
  status: "pending",
  payload: { roomNumber: "412" },
  createdAt: "2026-08-04T12:00:00.000Z",
};

const STUB_GATE = {
  approvalId: STUB_APPROVAL.id,
  applies: false,
  foodRelated: false,
  kashrutEnabled: false,
  latestStatus: null,
  latestMessageHe: null,
  canApprove: true,
  requiresAck: false,
  requiresOverrideBlock: false,
  gateHe: "לא נדרש שער כשרות",
};

/** Seed sessionStorage before first navigation (session-backed auth). */
export async function seedStubSession(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken, refreshToken, user }) => {
      sessionStorage.setItem("hotelos.accessToken", accessToken);
      sessionStorage.setItem("hotelos.refreshToken", refreshToken);
      sessionStorage.setItem("hotelos.user", JSON.stringify(user));
      localStorage.setItem(
        "hotelos.cookieConsent.v2026.1",
        JSON.stringify({
          necessary: true,
          functional: true,
          at: "2026-08-04T00:00:00.000Z",
        }),
      );
    },
    {
      accessToken: "axe-stub-access",
      refreshToken: "axe-stub-refresh",
      user: {
        id: STUB_ME.id,
        email: STUB_ME.email,
        displayName: STUB_ME.displayName,
        roles: STUB_ME.roles,
        tenantId: STUB_ME.scope.tenantId,
        hotelId: STUB_ME.scope.hotelId,
      },
    },
  );
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Soft API stub for secured-shell axe: auth/me + hotels + HITL + attendance.
 * Unknown /v1 paths get empty/ok envelopes so apps boot without a live API.
 */
export async function installSecuredApiStubs(page: Page): Promise<void> {
  await page.route("**/v1/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/v1/auth/me" && method === "GET") {
      await json(route, 200, STUB_ME);
      return;
    }
    if (path === "/v1/auth/logout" && method === "POST") {
      await json(route, 200, { data: { ok: true } });
      return;
    }
    if (path === "/v1/hotels" && method === "GET") {
      await json(route, 200, { data: [STUB_HOTEL] });
      return;
    }
    if (path === "/v1/overview/chain" && method === "GET") {
      await json(route, 200, {
        data: {
          tenantId: AXE_STUB_TENANT_ID,
          tenantName: "Demo Tenant",
          hotelCount: 1,
          hotels: [
            {
              id: STUB_HOTEL.id,
              name: STUB_HOTEL.name,
              timezone: STUB_HOTEL.timezone,
              currency: STUB_HOTEL.currency,
              chainId: STUB_HOTEL.chainId,
              rooms: {
                total: 10,
                vacant: 6,
                occupied: 3,
                dirty: 1,
                maintenance: 0,
              },
              bookings: {
                confirmed: 2,
                checkedIn: 3,
                active: 5,
              },
            },
          ],
        },
      });
      return;
    }
    if (path === "/v1/ai/approvals/pending" && method === "GET") {
      await json(route, 200, { data: [STUB_APPROVAL] });
      return;
    }
    if (path.startsWith("/v1/ai/approvals/recent") && method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }
    if (
      path.match(/^\/v1\/ai\/approvals\/[^/]+\/kashrut-gate$/) &&
      method === "GET"
    ) {
      await json(route, 200, { data: STUB_GATE });
      return;
    }
    if (path === "/v1/turbo/employees" && method === "GET") {
      await json(route, 200, {
        data: [
          {
            id: "e1000000-0000-4000-8000-000000000001",
            displayName: "עובד דמו",
            roleLabel: "Housekeeping",
            preferredLocale: "he",
            hotelId: AXE_STUB_HOTEL_ID,
          },
        ],
      });
      return;
    }
    if (path === "/v1/trust/attendance" && method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }
    if (path === "/v1/trust/cookies/consent" && method === "POST") {
      await json(route, 201, { data: { ok: true, policyVersion: "2026.1" } });
      return;
    }
    if (path.startsWith("/v1/hotels/") && path.endsWith("/rooms") && method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }
    if (path.startsWith("/v1/hotels/") && path.endsWith("/bookings") && method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }
    if (path.startsWith("/v1/hotels/") && path.endsWith("/notifications") && method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }

    if (method === "GET") {
      await json(route, 200, { data: [] });
      return;
    }
    await json(route, 200, { data: { ok: true } });
  });
}
