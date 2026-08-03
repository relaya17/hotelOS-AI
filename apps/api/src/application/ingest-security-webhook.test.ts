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
import { ingestSecurityWebhook } from "./ingest-security-webhook.js";

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
  enabledIntegrationDomains: [],
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
      id: "dept-security",
      tenantId,
      hotelId,
      code: "security",
      name: "Security",
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

describe("ingestSecurityWebhook", () => {
  it("creates a security task from a genetec payload", async () => {
    const ops = opsOk();
    const audit = auditOk();
    const result = await ingestSecurityWebhook(
      { hotels: hotelsOk(), ops, audit },
      {
        provider: "genetec",
        body: {
          SiteId: DEMO_HOTEL_TLV_ID,
          Name: "Intrusion",
          Message: "Parking lot",
          Severity: "Critical",
          Guid: "evt-1",
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.source, "genetec");
    assert.equal(result.hotelId, DEMO_HOTEL_TLV_ID);
    assert.equal(ops.created.length, 1);
    assert.equal(audit.rows.length, 1);
  });

  it("returns HOTEL_NOT_FOUND when site id is unknown", async () => {
    const result = await ingestSecurityWebhook(
      { hotels: hotelsOk(), ops: opsOk(), audit: auditOk() },
      {
        provider: "generic",
        body: {
          hotelId: "99999999-9999-4999-8999-999999999999",
          title: "Alarm",
          description: "Unknown site",
          priority: "medium",
          source: "test",
        },
      },
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "HOTEL_NOT_FOUND");
  });
});
