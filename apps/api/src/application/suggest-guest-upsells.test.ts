import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AiGateway, AiGatewayResponse } from "@hotelos/ai-gateway";
import type {
  BookingUpsellContext,
  PersistedUpsellOffer,
  UpsellRepository,
} from "@hotelos/database";
import type { BookingId, HotelId, TenantId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import {
  DEFAULT_UPSELL_COPY,
  countStayNights,
  evaluateUpsellOfferTypes,
  isStandardRoomType,
  parseUpsellCopyFromAnswer,
  suggestGuestUpsells,
} from "./suggest-guest-upsells.js";

const tenantId = Ids.tenant("11111111-1111-4111-8111-111111111111");
const hotelId = Ids.hotel("33333333-3333-4333-8333-333333333333");
const bookingId = Ids.booking("44444444-4444-4444-8444-444444444444");

function baseContext(
  overrides: Partial<BookingUpsellContext> = {},
): BookingUpsellContext {
  return {
    tenantId,
    hotelId,
    bookingId,
    guestEmail: "guest@example.com",
    guestName: "Demo Guest",
    checkInDate: "2026-08-03",
    checkOutDate: "2026-08-06",
    status: "checked_in",
    roomType: "standard",
    currency: "ILS",
    ...overrides,
  };
}

describe("evaluateUpsellOfferTypes", () => {
  it("suggests late checkout and spa for in-house stays", () => {
    const types = evaluateUpsellOfferTypes(
      baseContext({ status: "checked_in" }),
      "2026-08-03",
    );
    assert.ok(types.includes("late_checkout"));
    assert.ok(types.includes("spa"));
  });

  it("suggests dinner for stays of two nights or more", () => {
    const types = evaluateUpsellOfferTypes(
      baseContext({
        status: "confirmed",
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-12",
        roomType: "suite",
      }),
      "2026-08-09",
    );
    assert.deepEqual(types, ["dinner"]);
  });

  it("suggests room upgrade for standard rooms", () => {
    const types = evaluateUpsellOfferTypes(
      baseContext({
        status: "confirmed",
        checkInDate: "2026-08-10",
        checkOutDate: "2026-08-11",
        roomType: "standard",
      }),
      "2026-08-09",
    );
    assert.deepEqual(types, ["room_upgrade"]);
  });
});

describe("upsell helpers", () => {
  it("counts stay nights", () => {
    assert.equal(countStayNights("2026-08-03", "2026-08-06"), 3);
  });

  it("detects standard room types", () => {
    assert.equal(isStandardRoomType("standard"), true);
    assert.equal(isStandardRoomType("base"), true);
    assert.equal(isStandardRoomType("suite"), false);
  });

  it("parses upsell copy from agent answer", () => {
    const parsed = parseUpsellCopyFromAnswer(
      "כותרת: ספא VIP\nתיאור: עיסוי 90 דקות עם נוף",
    );
    assert.deepEqual(parsed, {
      titleHe: "ספא VIP",
      descriptionHe: "עיסוי 90 דקות עם נוף",
    });
  });
});

describe("suggestGuestUpsells", () => {
  it("persists offers and is idempotent per booking+offer_type", async () => {
    const ctx = baseContext();
    const stored = new Map<string, PersistedUpsellOffer>();

    const upsells: UpsellRepository = {
      loadBookingContext: async () => ctx,
      findSuggestedByBookingAndType: async (_t, _h, _b, offerType) => {
        const key = `${String(bookingId)}:${offerType}`;
        return stored.get(key) ?? null;
      },
      createSuggested: async (input) => {
        const offer: PersistedUpsellOffer = {
          id: input.id,
          tenantId: input.tenantId,
          hotelId: input.hotelId,
          bookingId: input.bookingId,
          guestEmail: input.guestEmail,
          offerType: input.offerType,
          titleHe: input.titleHe,
          descriptionHe: input.descriptionHe,
          priceAmount: input.priceAmount,
          currency: input.currency,
          status: "suggested",
          source: input.source,
          suggestedAt: input.suggestedAt,
          decidedAt: null,
          createdAt: input.createdAt,
        };
        stored.set(`${String(input.bookingId)}:${input.offerType}`, offer);
        return offer;
      },
      listByBooking: async () => [...stored.values()],
      listSuggestedForGuest: async () => [...stored.values()],
      findByIdInHotel: async () => null,
      decide: async () => null,
    };

    const gateway: AiGateway = {
      primaryProvider: "deterministic",
      async invoke(): Promise<AiGatewayResponse> {
        return {
          agentId: "agent.guest",
          answerHe: "תשובת Gateway (agent.guest, מצב דטרמיניסטי)",
          provider: "deterministic",
          confidence: "medium",
          citations: [],
          requiresHumanApproval: false,
          latencyMs: 1,
          model: "hotelos.deterministic.v1",
        };
      },
      async embed() {
        return { vectors: [[]], model: "hotelos.deterministic.embed.v1" };
      },
    };

    const first = await suggestGuestUpsells(upsells, gateway, {
      tenantId,
      hotelId,
      bookingId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      now: new Date("2026-08-03T10:00:00.000Z"),
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.offers.length, 4);
      assert.equal(
        first.offers.find((offer) => offer.offerType === "spa")?.titleHe,
        DEFAULT_UPSELL_COPY.spa.titleHe,
      );
    }

    const second = await suggestGuestUpsells(upsells, gateway, {
      tenantId,
      hotelId,
      bookingId,
      actorUserId: "55555555-5555-4555-8555-555555555555",
      now: new Date("2026-08-03T11:00:00.000Z"),
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.offers.length, 4);
      assert.equal(stored.size, 4);
    }
  });
});
