import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type AuditRepository,
  type AuditWrite,
  type CreateDepartmentTaskInput,
  type HotelRepository,
  type OpsRepository,
  type PersistedHotel,
} from "@hotelos/database";
import { Ids, type HotelId } from "@hotelos/shared";
import { ingestSentryWebhook } from "./ingest-sentry-webhook.js";

const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);
const tenantId = Ids.tenant(DEMO_TENANT_ID);

const demoHotel: PersistedHotel = {
  id: hotelId,
  tenantId,
  chainId: "chain-demo",
  name: "TLV Demo",
  timezone: "Asia/Jerusalem",
  currency: "ILS",
  kashrutEnabled: false,
};

function hotelsOk(): HotelRepository {
  return {
    findById: async (id: HotelId) => (id === hotelId ? demoHotel : null),
  } as unknown as HotelRepository;
}

function opsOk(): OpsRepository & { created: CreateDepartmentTaskInput[] } {
  const created: CreateDepartmentTaskInput[] = [];
  return {
    created,
    ensureStandardDepartments: async () => undefined,
    findDepartmentByCode: async () => ({
      id: "dept-it",
      tenantId,
      hotelId,
      code: "it",
      name: "IT",
      createdAt: "2026-01-01T00:00:00.000Z",
    }),
    createTask: async (input: CreateDepartmentTaskInput) => {
      created.push(input);
      return { ...input, status: "open" as const };
    },
  } as unknown as OpsRepository & { created: CreateDepartmentTaskInput[] };
}

function auditOk(): AuditRepository & { rows: AuditWrite[] } {
  const rows: AuditWrite[] = [];
  return {
    rows,
    append: async (row: AuditWrite) => {
      rows.push(row);
    },
  } as unknown as AuditRepository & { rows: AuditWrite[] };
}

describe("ingestSentryWebhook", () => {
  it("creates an IT task from a Sentry issue webhook", async () => {
    const ops = opsOk();
    const audit = auditOk();
    const result = await ingestSentryWebhook(
      { hotels: hotelsOk(), ops, audit },
      {
        defaultHotelId: DEMO_HOTEL_TLV_ID,
        body: {
          action: "created",
          data: {
            issue: {
              id: "99",
              title: "TypeError in handler",
              level: "error",
              project: { slug: "api" },
            },
          },
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok || result.skipped) return;
    assert.equal(result.source, "sentry");
    assert.equal(ops.created.length, 1);
    assert.equal(ops.created[0]?.taskType, "error_event");
    assert.equal(audit.rows.length, 1);
  });

  it("skips resolved issue webhooks without creating a task", async () => {
    const ops = opsOk();
    const result = await ingestSentryWebhook(
      { hotels: hotelsOk(), ops, audit: auditOk() },
      {
        defaultHotelId: DEMO_HOTEL_TLV_ID,
        body: {
          action: "resolved",
          data: { issue: { title: "Done", level: "error" } },
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.skipped, true);
    assert.equal(ops.created.length, 0);
  });
});
