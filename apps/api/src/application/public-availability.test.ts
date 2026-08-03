import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Ids } from "@hotelos/shared";
import type { PersistedBooking, PersistedRoom } from "@hotelos/database";
import { isRoomAvailableForDates } from "./public-availability.js";

const room: PersistedRoom = {
  id: Ids.room("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111"),
  hotelId: Ids.hotel("33333333-3333-4333-8333-333333333333"),
  number: "101",
  floor: "1",
  roomType: "standard",
  status: "vacant",
};

function booking(
  checkInDate: string,
  checkOutDate: string,
  status: PersistedBooking["status"] = "confirmed",
): PersistedBooking {
  return {
    id: Ids.booking("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    tenantId: room.tenantId,
    hotelId: room.hotelId,
    roomId: room.id,
    guestName: "Guest",
    guestEmail: "g@example.com",
    guestPhone: null,
    checkInDate,
    checkOutDate,
    status,
    roomPrepStatus: null,
    roomNumber: room.number,
  };
}

describe("isRoomAvailableForDates", () => {
  it("blocks overlapping confirmed stays", () => {
    assert.equal(
      isRoomAvailableForDates(
        room,
        [booking("2026-08-10", "2026-08-12")],
        "2026-08-11",
        "2026-08-13",
      ),
      false,
    );
  });

  it("allows adjacent dates (check-out = next check-in)", () => {
    assert.equal(
      isRoomAvailableForDates(
        room,
        [booking("2026-08-10", "2026-08-12")],
        "2026-08-12",
        "2026-08-14",
      ),
      true,
    );
  });

  it("ignores cancelled bookings", () => {
    assert.equal(
      isRoomAvailableForDates(
        room,
        [booking("2026-08-10", "2026-08-12", "cancelled")],
        "2026-08-10",
        "2026-08-12",
      ),
      true,
    );
  });
});
