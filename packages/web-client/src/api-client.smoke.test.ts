import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { submitLead } from "./api/public.js";
import { login } from "./api/auth.js";
import { decideAiApproval } from "./api/ai.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("submitLead", () => {
  it("POSTs /v1/leads and returns data", async () => {
    let seenUrl = "";
    let seenBody: unknown;
    globalThis.fetch = (async (input, init) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          data: {
            id: "lead-1",
            createdAt: "2026-08-04T12:00:00.000Z",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await submitLead({
      name: "Dana",
      hotelOrChain: "Coastal",
      email: "dana@example.com",
      note: "hi",
    });

    assert.match(seenUrl, /\/v1\/leads$/);
    assert.deepEqual(seenBody, {
      name: "Dana",
      hotelOrChain: "Coastal",
      email: "dana@example.com",
      note: "hi",
      source: "www_contact",
    });
    assert.equal(result.id, "lead-1");
  });

  it("throws on non-OK response", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: "Nope" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    await assert.rejects(
      () =>
        submitLead({
          name: "Dana",
          hotelOrChain: "Coastal",
          email: "dana@example.com",
        }),
      /Nope|Failed to submit lead/,
    );
  });
});

describe("login", () => {
  it("POSTs /v1/auth/login with tenant, email and password", async () => {
    let seenUrl = "";
    let seenBody: unknown;
    globalThis.fetch = (async (input, init) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          accessToken: "a",
          refreshToken: "r",
          user: {
            id: "u1",
            email: "admin@demo.hotelos.local",
            displayName: "Admin",
            roles: ["admin"],
            scope: { tenantId: "t1" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await login({
      tenantId: "t1",
      email: "admin@demo.hotelos.local",
      password: "demo",
    });

    assert.match(seenUrl, /\/v1\/auth\/login$/);
    assert.deepEqual(seenBody, {
      tenantId: "t1",
      email: "admin@demo.hotelos.local",
      password: "demo",
    });
    assert.equal(result.user.email, "admin@demo.hotelos.local");
    assert.equal(result.accessToken, "a");
  });
});

describe("decideAiApproval (HITL)", () => {
  it("POSTs decide with approved status", async () => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "sessionStorage", {
      value: {
        getItem: (k: string) => (memory.has(k) ? memory.get(k)! : null),
        setItem: (k: string, v: string) => {
          memory.set(k, v);
        },
        removeItem: (k: string) => {
          memory.delete(k);
        },
      },
      configurable: true,
    });
    memory.set("hotelos.accessToken", "test-token");

    let seenUrl = "";
    let seenBody: unknown;
    let seenAuth = "";
    globalThis.fetch = (async (input, init) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body ?? "{}"));
      const headers = new Headers(init?.headers);
      seenAuth = headers.get("Authorization") ?? "";
      return new Response(
        JSON.stringify({
          data: {
            id: "appr-1",
            status: "approved",
            kind: "department_task",
            summaryHe: "x",
            createdAt: "2026-08-04T12:00:00.000Z",
          },
          act: {
            status: "executed",
            action: "create_task",
            resourceType: "department_task",
            resourceId: "task-1",
            summaryHe: "בוצע",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await decideAiApproval("appr-1", "approved");
    assert.match(seenUrl, /\/v1\/ai\/approvals\/appr-1\/decide$/);
    assert.deepEqual(seenBody, { status: "approved" });
    assert.match(seenAuth, /Bearer test-token/);
    assert.equal(result.act.status, "executed");
    assert.equal(result.act.status === "executed" ? result.act.summaryHe : "", "בוצע");
  });
});
