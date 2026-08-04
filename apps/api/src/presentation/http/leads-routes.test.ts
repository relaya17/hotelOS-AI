import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLeadsRoutes } from "./leads-routes.js";

describe("leads routes", () => {
  it("creates a marketing lead and returns 201", async () => {
    const created: {
      id: string;
      name: string;
      hotelOrChain: string;
      email: string;
      note: string | null;
      source: string;
      createdAt: string;
    }[] = [];

    const app = createLeadsRoutes({
      leads: {
        async create(input: {
          readonly id: string;
          readonly name: string;
          readonly hotelOrChain: string;
          readonly email: string;
          readonly note: string | null;
          readonly source: string;
          readonly createdAt: string;
        }) {
          created.push(input);
          return input;
        },
      },
    });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dana Cohen",
        hotelOrChain: "Coastal Hotels",
        email: "Dana@Example.com",
        note: "Interested in Pilot",
        source: "www_contact",
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      data: { id: string; createdAt: string };
    };
    assert.ok(body.data.id);
    assert.ok(body.data.createdAt);
    assert.equal(created.length, 1);
    assert.equal(created[0]?.email, "dana@example.com");
    assert.equal(created[0]?.hotelOrChain, "Coastal Hotels");
  });

  it("rejects invalid email with 400", async () => {
    const app = createLeadsRoutes({
      leads: {
        async create() {
          throw new Error("should not be called");
        },
      },
    });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dana",
        hotelOrChain: "Coastal",
        email: "not-an-email",
      }),
    });

    assert.equal(res.status, 400);
  });
});
