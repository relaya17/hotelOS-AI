import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Ids } from "@hotelos/shared";
import { buildGuest360 } from "./build-guest-360.js";

const tenantId = Ids.tenant("11111111-1111-4111-8111-111111111111");
const hotelId = Ids.hotel("33333333-3333-4333-8333-333333333333");
const chainId = "chain-demo";

describe("buildGuest360", () => {
  it("aggregates profile, stays, feedback, and reputation signals", async () => {
    const result = await buildGuest360(
      {
        guestProfiles: {
          findByEmail: async () => ({
            id: "profile-1",
            tenantId,
            email: "noa@example.com",
            displayName: "נועה כהן",
            phone: "050-1234567",
            notesHe: "אוהבת חדר שקט",
            preferencesJson: '{"pillow":"soft"}',
            stayCount: 3,
            lastHotelId: hotelId,
            lastStayAt: "2026-07-20",
            marketingConsent: true,
            createdAt: "2026-01-01",
            updatedAt: "2026-07-20",
          }),
          rememberStay: async () => {
            throw new Error("not used");
          },
          listRecent: async () => [],
          countByTenant: async () => 0,
        },
        bookings: {
          listByGuestEmailAtHotel: async () => [
            {
              id: Ids.booking("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
              hotelId,
              hotelName: "Hotel Demo",
              roomNumber: "402",
              guestName: "נועה כהן",
              checkInDate: "2026-08-01",
              checkOutDate: "2026-08-04",
              status: "confirmed",
            },
          ],
          listByGuestEmailInChain: async () => [
            {
              id: Ids.booking("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
              hotelId: Ids.hotel("44444444-4444-4444-8444-444444444444"),
              hotelName: "Hotel Sister",
              roomNumber: "201",
              guestName: "נועה כהן",
              checkInDate: "2026-06-01",
              checkOutDate: "2026-06-03",
              status: "checked_out",
            },
          ],
        } as never,
        feedback: {
          listByGuestEmail: async () => [
            {
              id: "fb-1",
              hotelId,
              bookingId: "booking-1",
              rating: 5,
              categories: ["cleanliness"],
              comment: "מצוין",
              source: "guest_app_survey",
              submittedAt: "2026-07-21T10:00:00.000Z",
            },
          ],
        } as never,
        reputation: {
          listByAuthorName: async (
            _tenant: string,
            _hotel: string,
            name: string,
          ) => {
            assert.equal(name, "נועה כהן");
            return [
              {
                id: "rev-1",
                tenantId,
                hotelId,
                source: "google",
                externalId: "g-1",
                rating: 5,
                title: "Great stay",
                body: "Lovely hotel",
                authorName: "נועה כהן",
                reviewUrl: null,
                reviewedAt: "2026-07-22",
                sentiment: "positive",
                topics: ["service"],
                taskId: null,
                createdAt: "2026-07-22",
              },
            ];
          },
        } as never,
        hotels: {
          findById: async () => ({
            id: hotelId,
            tenantId,
            chainId,
            name: "Hotel Demo",
            timezone: "Asia/Jerusalem",
            currency: "ILS",
            kashrutEnabled: false,
          }),
        } as never,
      },
      {
        tenantId,
        hotelId,
        email: "noa@example.com",
      },
    );

    assert.ok(result);
    assert.equal(result!.email, "noa@example.com");
    assert.equal(result!.profile?.displayName, "נועה כהן");
    assert.deepEqual(result!.profile?.preferences, { pillow: "soft" });
    assert.equal(result!.staysAtHotel.length, 1);
    assert.equal(result!.chainStayCount, 1);
    assert.equal(result!.lastFeedback?.rating, 5);
    assert.equal(result!.reputationSignals.length, 1);
    assert.equal(result!.reputationSignals[0]?.source, "google");
  });

  it("returns null when hotel is outside tenant", async () => {
    const result = await buildGuest360(
      {
        guestProfiles: {
          findByEmail: async () => null,
          rememberStay: async () => {
            throw new Error("not used");
          },
          listRecent: async () => [],
          countByTenant: async () => 0,
        },
        bookings: {
          listByGuestEmailAtHotel: async () => [],
          listByGuestEmailInChain: async () => [],
        } as never,
        feedback: {
          listByGuestEmail: async () => [],
        } as never,
        reputation: {
          listByAuthorName: async () => [],
        } as never,
        hotels: {
          findById: async () => ({
            id: hotelId,
            tenantId: Ids.tenant("99999999-9999-4999-8999-999999999999"),
            chainId,
            name: "Other",
            timezone: "UTC",
            currency: "USD",
            kashrutEnabled: false,
          }),
        } as never,
      },
      {
        tenantId,
        hotelId,
        email: "guest@example.com",
      },
    );

    assert.equal(result, null);
  });
});
