import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BookingRepository,
  EnergyRepository,
  OverviewRepository,
  RoomRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  buildEnergySuggestionDrafts,
  ENERGY_HIGH_OCCUPANCY_PCT,
  ENERGY_LOW_OCCUPANCY_PCT,
  findEmptyFloors,
  suggestEnergyActions,
} from "./suggest-energy-actions.js";

describe("suggest-energy-actions", () => {
  it("detects fully vacant floors", () => {
    const empty = findEmptyFloors(
      [
        {
          id: Ids.room("00000000-0000-4000-8000-000000000101"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "101",
          floor: "1",
          roomType: "standard",
          status: "vacant",
        },
        {
          id: Ids.room("00000000-0000-4000-8000-000000000102"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "102",
          floor: "1",
          roomType: "standard",
          status: "vacant",
        },
        {
          id: Ids.room("00000000-0000-4000-8000-000000000201"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "201",
          floor: "2",
          roomType: "deluxe",
          status: "occupied",
        },
      ],
      new Set<string>(),
    );
    assert.deepEqual(empty, ["1"]);
  });

  it("suggests HVAC setback for low occupancy", () => {
    const drafts = buildEnergySuggestionDrafts(
      "2026-08-03",
      ENERGY_LOW_OCCUPANCY_PCT - 10,
      [],
    );
    assert.equal(drafts.length, 1);
    assert.match(drafts[0]?.suggestionHe ?? "", /setback/i);
    assert.ok((drafts[0]?.estimatedSavingPct ?? 0) >= 8);
  });

  it("warns on peak load for high occupancy", () => {
    const drafts = buildEnergySuggestionDrafts(
      "2026-08-03",
      ENERGY_HIGH_OCCUPANCY_PCT,
      [],
    );
    assert.equal(drafts.length, 1);
    assert.match(drafts[0]?.suggestionHe ?? "", /peak load/i);
    assert.equal(drafts[0]?.estimatedSavingPct, 0);
  });

  it("adds empty-floor HVAC suggestions", () => {
    const drafts = buildEnergySuggestionDrafts("2026-08-03", 55, ["3", "5"]);
    assert.equal(drafts.length, 2);
    assert.match(drafts[0]?.suggestionHe ?? "", /קומה 3/);
    assert.match(drafts[1]?.suggestionHe ?? "", /קומה 5/);
  });

  it("persists daily suggestions idempotently", async () => {
    let deleteCalls = 0;
    const created: unknown[] = [];

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
              total: 10,
              vacant: 8,
              occupied: 2,
              dirty: 0,
              maintenance: 0,
            },
            bookings: { confirmed: 1, checkedIn: 1, active: 2 },
          },
        ],
      }),
    } as unknown as OverviewRepository;

    const bookings = {
      listByHotel: async () => [
        {
          id: "b1",
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          roomId: "r1",
          guestName: "Guest",
          guestEmail: "g@test.com",
          guestPhone: null,
          checkInDate: "2026-08-01",
          checkOutDate: "2026-08-15",
          status: "checked_in" as const,
          roomPrepStatus: null,
          roomNumber: "101",
        },
      ],
    } as unknown as BookingRepository;

    const rooms = {
      listByHotel: async () => [
        {
          id: Ids.room("00000000-0000-4000-8000-000000000101"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "101",
          floor: "1",
          roomType: "standard",
          status: "occupied" as const,
        },
        {
          id: Ids.room("00000000-0000-4000-8000-000000000102"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "102",
          floor: "2",
          roomType: "standard",
          status: "vacant" as const,
        },
        {
          id: Ids.room("00000000-0000-4000-8000-000000000103"),
          tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
          hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
          number: "103",
          floor: "2",
          roomType: "standard",
          status: "vacant" as const,
        },
      ],
    } as unknown as RoomRepository;

    const energy = {
      deleteSuggestedForDate: async () => {
        deleteCalls += 1;
      },
      createSuggestions: async (inputs: readonly unknown[]) => {
        created.push(...inputs);
        return inputs.map((row, index) => ({
          ...(row as Record<string, unknown>),
          status: "suggested",
          id: `e${index}`,
        }));
      },
    } as unknown as EnergyRepository;

    const result = await suggestEnergyActions(
      { overview, bookings, rooms, energy },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
        now: new Date("2026-08-03T08:00:00.000Z"),
      },
    );

    assert.ok(result);
    assert.equal(deleteCalls, 1);
    assert.equal(result.periodDate, "2026-08-03");
    assert.ok(created.length >= 1);
    assert.match(result.hotelName, /Demo/);
  });
});
