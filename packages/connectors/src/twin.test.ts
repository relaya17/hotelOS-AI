import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPmsConnector } from "./pms/create-pms-connector.js";
import { createDemoPmsConnector } from "./pms/demo-pms.js";
import { createMewsStubPmsConnector } from "./pms/mews-stub-pms.js";
import { createOperaStubPmsConnector } from "./pms/opera-stub-pms.js";
import { mergeHotelTwin } from "./twin.js";

describe("mergeHotelTwin", () => {
  it("merges hotelos rooms with demo PMS inventory", async () => {
    const pms = await createDemoPmsConnector().fetchInventory("demo-hotel");
    const twin = mergeHotelTwin({
      hotelId: "h1",
      hotelosRooms: [
        { roomNumber: "101", status: "vacant" },
        { roomNumber: "999", status: "occupied" },
      ],
      pms,
    });

    assert.equal(twin.hotelId, "h1");
    assert.ok(twin.rooms.some((r) => r.roomNumber === "101" && r.source === "merged"));
    assert.ok(twin.rooms.some((r) => r.roomNumber === "999" && r.source === "hotelos"));
    assert.ok(twin.rooms.some((r) => r.roomNumber === "102" && r.source === "pms"));
    assert.equal(twin.pms?.providerId, "demo.pms");
    assert.ok((twin.pms?.reservations.length ?? 0) >= 1);
  });

  it("merges with mews stub inventory under mews.stub providerId", async () => {
    const pms = await createMewsStubPmsConnector().fetchInventory("demo-hotel");
    const twin = mergeHotelTwin({
      hotelId: "h1",
      hotelosRooms: [{ roomNumber: "101", status: "occupied" }],
      pms,
    });

    assert.equal(twin.pms?.providerId, "mews.stub");
    assert.ok(twin.rooms.some((r) => r.roomNumber === "103" && r.source === "pms"));
    assert.ok(twin.rooms.some((r) => r.roomNumber === "301" && r.status === "dirty"));
  });

  it("merges with opera stub inventory under opera.stub providerId", async () => {
    const connector = createPmsConnector("opera_stub");
    assert.equal(connector.providerId, "opera.stub");
    const pms = await createOperaStubPmsConnector().fetchInventory("demo-hotel");
    const twin = mergeHotelTwin({
      hotelId: "h1",
      hotelosRooms: [{ roomNumber: "205", status: "vacant" }],
      pms,
    });

    assert.equal(twin.pms?.providerId, "opera.stub");
    assert.ok(twin.rooms.some((r) => r.roomNumber === "205" && r.source === "merged"));
    assert.ok(twin.rooms.some((r) => r.roomNumber === "410" && r.status === "maintenance"));
    assert.equal(twin.pms?.reservationCount, 2);
    assert.equal(twin.pms?.reservations[0]?.roomNumber, "205");
    assert.equal(twin.pms?.reservations[0]?.status, "in_house");
  });

  it("switches PMS_PROVIDER stubs for Protel / Fidelio / Clock", async () => {
    for (const [provider, expectedId] of [
      ["protel_stub", "protel.stub"],
      ["fidelio_stub", "fidelio.stub"],
      ["clock_stub", "clock.stub"],
    ] as const) {
      const connector = createPmsConnector(provider);
      assert.equal(connector.providerId, expectedId);
      const inventory = await connector.fetchInventory("demo-hotel");
      assert.ok(inventory.rooms.length >= 2);
    }
  });
});
