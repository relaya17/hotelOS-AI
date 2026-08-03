import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  BookingRepository,
  OverviewRepository,
  RevenueSuggestionsRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import {
  bookingOccupiesNight,
  buildRevenueRateSuggestionDrafts,
  countOccupiedRoomsOnNight,
  suggestRateDeltaForOccupancy,
  suggestRevenueRates,
} from "./suggest-revenue-rates.js";

describe("suggest-revenue-rates", () => {
  it("detects night overlap for bookings", () => {
    assert.equal(
      bookingOccupiesNight("2026-08-01", "2026-08-03", "2026-08-01"),
      true,
    );
    assert.equal(
      bookingOccupiesNight("2026-08-01", "2026-08-03", "2026-08-03"),
      false,
    );
    assert.equal(
      bookingOccupiesNight("2026-08-01", "2026-08-03", "2026-08-02"),
      true,
    );
  });

  it("suggests increase for high occupancy", () => {
    const result = suggestRateDeltaForOccupancy(90);
    assert.ok(result.suggestedDeltaPct >= 5);
    assert.ok(result.suggestedDeltaPct <= 12);
    assert.match(result.rationaleHe, /תפוסה גבוהה/);
  });

  it("suggests promo for low occupancy", () => {
    const result = suggestRateDeltaForOccupancy(20);
    assert.equal(result.suggestedDeltaPct, -5);
    assert.match(result.rationaleHe, /מבצע/);
  });

  it("holds price for shoulder occupancy", () => {
    const result = suggestRateDeltaForOccupancy(55);
    assert.equal(result.suggestedDeltaPct, 0);
    assert.match(result.rationaleHe, /shoulder/);
  });

  it("builds daily drafts for 7 days", () => {
    const bookings = [
      {
        checkInDate: "2026-08-01",
        checkOutDate: "2026-08-08",
        status: "confirmed",
      },
      {
        checkInDate: "2026-08-01",
        checkOutDate: "2026-08-08",
        status: "checked_in",
      },
    ];
    const drafts = buildRevenueRateSuggestionDrafts(
      10,
      bookings,
      7,
      new Date("2026-08-01T12:00:00.000Z"),
    );
    assert.equal(drafts.length, 7);
    assert.equal(countOccupiedRoomsOnNight(bookings, "2026-08-01"), 2);
    assert.equal(drafts[0]?.currentOccupancyPct, 20);
  });

  it("persists suggestions without PMS side effects", async () => {
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
              total: 100,
              vacant: 10,
              occupied: 90,
              dirty: 0,
              maintenance: 0,
            },
            bookings: { confirmed: 10, checkedIn: 80, active: 90 },
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

    const revenueSuggestions = {
      deleteSuggestedForPeriods: async () => {},
      createMany: async (inputs: readonly unknown[]) => {
        created.push(...inputs);
        return inputs.map((input, index) => ({
          ...(input as Record<string, unknown>),
          status: "suggested",
          decidedByUserId: null,
          decidedAt: null,
          id: `s${index}`,
        }));
      },
    } as unknown as RevenueSuggestionsRepository;

    const result = await suggestRevenueRates(
      { overview, bookings, revenueSuggestions },
      {
        tenantId: Ids.tenant("00000000-0000-4000-8000-000000000001"),
        hotelId: Ids.hotel("00000000-0000-4000-8000-000000000010"),
        now: new Date("2026-08-01T08:00:00.000Z"),
      },
    );

    assert.ok(result);
    assert.equal(result.suggestions.length, 7);
    assert.ok(created.length >= 7);
    assert.match(result.hotelName, /Demo/);
  });
});
