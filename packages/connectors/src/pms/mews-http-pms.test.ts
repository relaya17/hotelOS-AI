import assert from "node:assert/strict";
import { test } from "node:test";
import { createMewsHttpPmsConnector } from "./mews-http-pms.js";

test("mews http connector maps resources and reservations", async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/resources/getAll")) {
      return new Response(
        JSON.stringify({
          Resources: [
            { Id: "r1", Name: "101", State: "Clean" },
            { Id: "r2", Name: "102", State: "Dirty" },
            { Id: "r3", Name: "201", State: "OutOfOrder" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/reservations/getAll")) {
      return new Response(
        JSON.stringify({
          Reservations: [
            {
              Id: "res1",
              Number: "42",
              State: "Started",
              AssignedResourceId: "r1",
              ScheduledStartUtc: "2026-08-01T14:00:00Z",
              ScheduledEndUtc: "2026-08-03T11:00:00Z",
            },
            {
              Id: "res2",
              Number: "43",
              State: "Confirmed",
              AssignedResourceId: "r2",
              ScheduledStartUtc: "2026-08-04T14:00:00Z",
              ScheduledEndUtc: "2026-08-06T11:00:00Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("not found", { status: 404 });
  };

  const connector = createMewsHttpPmsConnector({
    clientToken: "client-token",
    accessToken: "access-token",
    platformUrl: "https://api.mews-demo.com",
    fetchImpl,
  });

  const inventory = await connector.fetchInventory("demo-hotel");
  assert.equal(connector.providerId, "mews");
  assert.equal(inventory.providerId, "mews");
  assert.equal(inventory.rooms.length, 3);
  assert.equal(
    inventory.rooms.find((room) => room.roomNumber === "101")?.status,
    "occupied",
  );
  assert.equal(
    inventory.rooms.find((room) => room.roomNumber === "102")?.status,
    "dirty",
  );
  assert.equal(
    inventory.rooms.find((room) => room.roomNumber === "201")?.status,
    "maintenance",
  );
  assert.equal(inventory.reservations.length, 2);
  assert.equal(inventory.reservations[0]?.status, "in_house");
  assert.equal(inventory.reservations[0]?.roomNumber, "101");
  assert.ok(calls.some((url) => url.includes("/resources/getAll")));
  assert.ok(calls.some((url) => url.includes("/reservations/getAll")));
});

test("mews http connector requires tokens", () => {
  assert.throws(
    () =>
      createMewsHttpPmsConnector({
        clientToken: "",
        accessToken: "",
      }),
    /MEWS_CLIENT_TOKEN/,
  );
});
