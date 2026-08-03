import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ALL_PILOT_INTEGRATION_DOMAIN_IDS,
  DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS,
} from "@hotelos/connectors";
import { Ids } from "@hotelos/shared";
import { createDb } from "./client.js";
import { createHotelRepository } from "./repositories/hotel-repository.js";
import { hotelChains, hotels, tenants } from "./schema/tenancy.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CHAIN_ID = "22222222-2222-4222-8222-222222222222";
const HOTEL_ID = "33333333-3333-4333-8333-333333333333";

async function seedMinimalHotel(db: Awaited<ReturnType<typeof createDb>>["db"]) {
  const now = new Date().toISOString();
  await db.insert(tenants).values({
    id: TENANT_ID,
    name: "Test Tenant",
    slug: "test-tenant",
    createdAt: now,
  }).run();
  await db.insert(hotelChains).values({
    id: CHAIN_ID,
    tenantId: TENANT_ID,
    name: "Test Chain",
    createdAt: now,
  }).run();
  await db.insert(hotels).values({
    id: HOTEL_ID,
    tenantId: TENANT_ID,
    chainId: CHAIN_ID,
    name: "Test Hotel",
    timezone: "Asia/Jerusalem",
    currency: "ILS",
    kashrutEnabled: 0,
    createdAt: now,
  }).run();
}

describe("hotel integration domains", () => {
  it("migrate adds enabled_integration_domains without breaking reads", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hotelos-domains-"));
    const { db, close } = await createDb(join(dir, "test.sqlite"));
    await seedMinimalHotel(db);

    const hotelRepo = createHotelRepository(db);
    const tenantId = Ids.tenant(TENANT_ID);
    const hotelId = Ids.hotel(HOTEL_ID);

    const defaults = await hotelRepo.getEnabledIntegrationDomains(
      tenantId,
      hotelId,
    );
    assert.deepEqual(defaults, ALL_PILOT_INTEGRATION_DOMAIN_IDS);

    const updated = await hotelRepo.setEnabledIntegrationDomains(
      tenantId,
      hotelId,
      ["pms", "reputation"],
    );
    assert.ok(updated);
    assert.deepEqual(updated.enabledIntegrationDomains, ["pms", "reputation"]);

    await hotelRepo.setEnabledIntegrationDomains(tenantId, hotelId, []);
    const resolvedEmpty = await hotelRepo.getEnabledIntegrationDomains(
      tenantId,
      hotelId,
    );
    assert.deepEqual(resolvedEmpty, DEFAULT_PILOT_INTEGRATION_DOMAIN_IDS);

    close();
  });
});
