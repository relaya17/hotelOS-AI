import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OverviewRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  REVENUE_APPROVAL_ADR_THRESHOLD_PCT,
  runRevenueSimulator,
} from "./run-revenue-simulator.js";

describe("runRevenueSimulator", () => {
  const overview = {
    getChainOverview: async () => ({
      tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
      tenantName: "Demo",
      hotelCount: 1,
      hotels: [
        {
          id: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          name: "Demo TLV",
          timezone: "Asia/Jerusalem",
          currency: "ILS",
          chainId: "c1",
          rooms: {
            total: 100,
            vacant: 40,
            occupied: 60,
            dirty: 0,
            maintenance: 0,
          },
          bookings: { confirmed: 10, checkedIn: 50, active: 60 },
        },
      ],
    }),
  } as unknown as OverviewRepository;

  it("returns baseline vs proposed without executing changes", async () => {
    const result = await runRevenueSimulator(overview, {
      tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
      hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
      adrChangePercent: 15,
      baseAdr: 800,
      nights: 1,
    });
    assert.ok(result);
    assert.equal(result.executesChange, false);
    assert.equal(result.requiresHumanApproval, true);
    assert.ok(result.proposed.adr > result.baseline.adr);
    assert.ok(result.proposed.occupancyPct < result.baseline.occupancyPct);
    assert.ok(
      Math.abs(result.delta.adrPct) >= REVENUE_APPROVAL_ADR_THRESHOLD_PCT,
    );
  });

  it("does not require approval for small ADR moves", async () => {
    const result = await runRevenueSimulator(overview, {
      tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
      hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
      adrChangePercent: 3,
      baseAdr: 800,
      nights: 1,
    });
    assert.ok(result);
    assert.equal(result.requiresHumanApproval, false);
  });
});
