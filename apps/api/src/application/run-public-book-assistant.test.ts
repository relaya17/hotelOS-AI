import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPublicBookAssistant } from "./run-public-book-assistant.js";

function stubHotel(id = "33333333-3333-4333-8333-333333333333") {
  return {
    id,
    tenantId: "11111111-1111-4111-8111-111111111111",
    name: "HotelOS TLV Demo",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    kashrutEnabled: false,
  };
}

describe("runPublicBookAssistant", () => {
  it("extracts relative dates, room type and guest contact from one utterance", async () => {
    const hotel = stubHotel();
    const deps = {
      hotels: {
        listAll: async () => [hotel],
        findById: async () => hotel,
      },
      rooms: {
        listByHotel: async () => [
          {
            id: "r1",
            hotelId: hotel.id,
            roomNumber: "101",
            roomType: "deluxe",
            status: "vacant",
          },
        ],
      },
      bookings: {
        listByHotel: async () => [],
        create: async () => {
          throw new Error("should not book yet");
        },
      },
      audit: {
        append: async () => undefined,
      },
      trust: {},
      payments: {
        name: "demo" as const,
        createIntent: async () => {
          throw new Error("should not charge yet");
        },
        confirmIntent: async () => {
          throw new Error("should not charge yet");
        },
        charge: async () => {
          throw new Error("should not charge yet");
        },
      },
    };
    const result = await runPublicBookAssistant(deps as never, {
      message: "מחר ליומיים חדר דלוקס שמי רחל כהן rachel@demo.hotelos.local",
    });

    assert.equal(result.draft.roomType, "deluxe");
    assert.equal(result.draft.guestName, "רחל כהן");
    assert.equal(result.draft.guestEmail, "rachel@demo.hotelos.local");
    assert.ok(result.draft.checkInDate);
    assert.ok(result.draft.checkOutDate);
    assert.equal(result.readyToConfirm, true);
    assert.match(result.replyHe, /אשר|מוכן/);
  });
});
