import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { Ids } from "@hotelos/shared";
import { createDb } from "../client.js";
import { bookings as bookingsTable } from "../schema/tenancy.js";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  seedDemoTenant,
} from "../seed.js";
import { createBookingRepository } from "./booking-repository.js";
import { createGuestStayRepository } from "./guest-stay-repository.js";
import { createRoomRepository } from "./room-repository.js";

test("guest check-out marks room dirty and advances waiting peer", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hotelos-co-"));
  const { db, close } = await createDb(join(dir, "test.sqlite"));
  await seedDemoTenant(db, async () => "scrypt$testsalt$00");

  const guest = createGuestStayRepository(db);
  const bookings = createBookingRepository(db);
  const rooms = createRoomRepository(db);
  const tenantId = Ids.tenant(DEMO_TENANT_ID);
  const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
  const occupiedBookingId = Ids.booking(
    "80000000-0000-4000-8000-000000000001",
  );
  const waitingBookingId = Ids.booking(
    "80000000-0000-4000-8000-000000000004",
  );
  const occupiedRoomId = Ids.room("70000000-0000-4000-8000-000000000201");

  // Put waiting guest on the occupied room so checkout advances them.
  await db
    .update(bookingsTable)
    .set({
      roomId: occupiedRoomId,
      roomPrepStatus: "waiting",
    })
    .where(eq(bookingsTable.id, waitingBookingId))
    .run();

  const result = await guest.checkOutByEmail(
    "noa@example.com",
    occupiedBookingId,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.stay.status, "checked_out");
    assert.equal(result.stay.roomStatus, "dirty");
  }

  const room = await rooms.findByIdInHotel(
    tenantId,
    hotelId,
    occupiedRoomId,
  );
  assert.ok(room);
  assert.equal(room.status, "dirty");

  const waiting = await bookings.findByIdInHotel(
    tenantId,
    hotelId,
    waitingBookingId,
  );
  assert.ok(waiting);
  assert.equal(waiting.roomPrepStatus, "cleaning");

  const again = await guest.checkOutByEmail(
    "noa@example.com",
    occupiedBookingId,
  );
  assert.equal(again.ok, false);
  if (!again.ok) {
    assert.equal(again.reason, "NOT_CHECKED_IN");
  }

  close();
});
