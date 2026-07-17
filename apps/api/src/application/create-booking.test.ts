import assert from "node:assert/strict";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import type { AuthPrincipal } from "@hotelos/auth";
import { createBooking } from "./create-booking.js";

test("createBooking rejects invalid date range", async () => {
  const principal: AuthPrincipal = {
    userId: Ids.user("55555555-5555-4555-8555-555555555555"),
    roles: ["admin"],
    scope: { tenantId: Ids.tenant("11111111-1111-4111-8111-111111111111") },
  };

  const result = await createBooking(
    {
      hotelBelongsToTenant: async () => true,
      findRoomInHotel: async () => ({
        id: Ids.room("70000000-0000-4000-8000-000000000101"),
        number: "101",
        status: "vacant",
      }),
      listByHotel: async () => [],
      findByIdInHotel: async () => null,
      updateStatus: async () => null,
      create: async () => {
        throw new Error("should not create");
      },
    },
    {
      append: async () => {
        throw new Error("should not audit");
      },
    },
    principal,
    {
      hotelId: "33333333-3333-4333-8333-333333333333",
      roomId: "70000000-0000-4000-8000-000000000101",
      guestName: "Test Guest",
      guestEmail: "test@example.com",
      checkInDate: "2026-07-24",
      checkOutDate: "2026-07-21",
      status: "confirmed",
    },
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "INVALID_DATES");
  }
});
