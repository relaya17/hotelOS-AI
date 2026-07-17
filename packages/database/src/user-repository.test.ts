import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Ids } from "@hotelos/shared";
import { createDb } from "./client.js";
import { createUserRepository } from "./repositories/user-repository.js";
import { createHotelRepository } from "./repositories/hotel-repository.js";
import {
  seedDemoTenant,
  DEMO_TENANT_ID,
  DEMO_USER_EMAIL,
} from "./seed.js";

test("seeded demo user can be loaded by tenant email", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hotelos-db-"));
  const { db, close } = createDb(join(dir, "test.sqlite"));
  await seedDemoTenant(db, async () => "scrypt$testsalt$00");

  const users = createUserRepository(db);
  const user = await users.findByTenantAndEmail(
    Ids.tenant(DEMO_TENANT_ID),
    DEMO_USER_EMAIL,
  );

  assert.ok(user);
  assert.equal(user.email, DEMO_USER_EMAIL);
  assert.ok(user.roles.includes("admin"));

  const hotels = createHotelRepository(db);
  const list = await hotels.listByTenant(Ids.tenant(DEMO_TENANT_ID));
  assert.equal(list.length, 2);

  const { createRoomRepository } = await import(
    "./repositories/room-repository.js"
  );
  const rooms = createRoomRepository(db);
  const firstHotel = list[0];
  assert.ok(firstHotel);
  const roomList = await rooms.listByHotel(
    Ids.tenant(DEMO_TENANT_ID),
    firstHotel.id,
  );
  assert.ok(roomList.length >= 3);
  close();
});
