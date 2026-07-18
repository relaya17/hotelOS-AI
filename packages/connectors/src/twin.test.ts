import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoPmsConnector } from "./pms/demo-pms.js";
import { createMewsStubPmsConnector } from "./pms/mews-stub-pms.js";
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
});
