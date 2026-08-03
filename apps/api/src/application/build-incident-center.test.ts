import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEMO_HOTEL_TLV_ID,
  DEMO_TENANT_ID,
  type HotelRepository,
  type MaintenanceRepository,
  type OpsRepository,
  type PersistedDepartmentTask,
  type PersistedHotel,
  type PersistedMaintenanceRequest,
} from "@hotelos/database";
import { Ids, type HotelId, type TenantId } from "@hotelos/shared";
import { buildIncidentCenter } from "./build-incident-center.js";

const tenantId = Ids.tenant(DEMO_TENANT_ID);
const hotelId = Ids.hotel(DEMO_HOTEL_TLV_ID);

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

function task(
  overrides: Partial<PersistedDepartmentTask> & {
    readonly id: string;
    readonly departmentId: string;
    readonly taskType: string;
  },
): PersistedDepartmentTask {
  return {
    tenantId,
    hotelId,
    title: "Incident",
    description: "desc",
    priority: "high",
    status: "open",
    assignedToUserId: null,
    dueAt: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function maintenanceRequest(
  overrides: Partial<PersistedMaintenanceRequest> & { readonly id: string },
): PersistedMaintenanceRequest {
  return {
    tenantId,
    hotelId,
    category: "repair",
    title: "Broken AC",
    description: "Room 101",
    priority: "urgent",
    status: "open",
    vendorId: null,
    dueAt: null,
    estimatedCost: null,
    actualCost: null,
    createdAt: "2026-08-02T08:00:00.000Z",
    updatedAt: "2026-08-02T08:00:00.000Z",
    ...overrides,
  };
}

function createDeps(input: {
  readonly tasksByDept: Readonly<Record<string, readonly PersistedDepartmentTask[]>>;
  readonly maintenance?: readonly PersistedMaintenanceRequest[];
}): BuildIncidentCenterDeps {
  const deptIds: Record<string, string> = {
    security: "dept-sec",
    it: "dept-it",
    maintenance: "dept-maint",
  };

  return {
    hotels: {
      listByTenant: async () => [demoHotel],
    } as unknown as HotelRepository,
    ops: {
      ensureStandardDepartments: async () => undefined,
      findDepartmentByCode: async (
        _t: TenantId,
        _h: HotelId,
        code: string,
      ) =>
        deptIds[code]
          ? {
              id: deptIds[code]!,
              hotelId,
              code,
              name: code,
            }
          : null,
      listTasksByDepartment: async (
        _t: TenantId,
        _h: HotelId,
        departmentId: string,
      ) => input.tasksByDept[departmentId] ?? [],
    } as unknown as OpsRepository,
    maintenance: {
      listByHotel: async () => input.maintenance ?? [],
    } as unknown as MaintenanceRepository,
  };
}

type BuildIncidentCenterDeps = Parameters<typeof buildIncidentCenter>[0];

describe("buildIncidentCenter", () => {
  it("collects incident tasks from security, IT, and maintenance departments", async () => {
    const deps = createDeps({
      tasksByDept: {
        "dept-sec": [
          task({
            id: "t-sec",
            departmentId: "dept-sec",
            taskType: "security_event",
            priority: "urgent",
            createdAt: "2026-08-03T09:00:00.000Z",
          }),
        ],
        "dept-it": [
          task({
            id: "t-it",
            departmentId: "dept-it",
            taskType: "error_event",
            priority: "high",
            createdAt: "2026-08-03T08:00:00.000Z",
          }),
        ],
        "dept-maint": [
          task({
            id: "t-low",
            departmentId: "dept-maint",
            taskType: "patrol",
            priority: "low",
            createdAt: "2026-08-03T07:00:00.000Z",
          }),
        ],
      },
      maintenance: [
        maintenanceRequest({
          id: "mr-1",
          priority: "urgent",
          createdAt: "2026-08-03T10:00:00.000Z",
        }),
      ],
    });

    const center = await buildIncidentCenter(deps, tenantId, [hotelId]);
    assert.equal(center.incidents.length, 3);

    const ids = center.incidents.map((incident) => incident.id);
    assert.ok(ids.includes("task:t-sec"));
    assert.ok(ids.includes("task:t-it"));
    assert.ok(ids.includes("maint:mr-1"));
    assert.ok(!ids.includes("task:t-low"));
  });

  it("sorts by severity then recency", async () => {
    const deps = createDeps({
      tasksByDept: {
        "dept-sec": [
          task({
            id: "t-high-old",
            departmentId: "dept-sec",
            taskType: "security_event",
            priority: "high",
            createdAt: "2026-08-01T10:00:00.000Z",
          }),
        ],
        "dept-it": [
          task({
            id: "t-urgent-new",
            departmentId: "dept-it",
            taskType: "anomaly_alert",
            priority: "urgent",
            createdAt: "2026-08-03T12:00:00.000Z",
          }),
          task({
            id: "t-urgent-old",
            departmentId: "dept-it",
            taskType: "anomaly_alert",
            priority: "urgent",
            createdAt: "2026-08-02T12:00:00.000Z",
          }),
        ],
      },
    });

    const center = await buildIncidentCenter(deps, tenantId, [hotelId]);
    assert.deepEqual(
      center.incidents.map((incident) => incident.id),
      ["task:t-urgent-new", "task:t-urgent-old", "task:t-high-old"],
    );
  });

  it("excludes closed tasks and done maintenance requests", async () => {
    const deps = createDeps({
      tasksByDept: {
        "dept-it": [
          task({
            id: "t-done",
            departmentId: "dept-it",
            taskType: "error_event",
            status: "done",
          }),
        ],
      },
      maintenance: [
        maintenanceRequest({ id: "mr-done", status: "done", priority: "urgent" }),
      ],
    });

    const center = await buildIncidentCenter(deps, tenantId, [hotelId]);
    assert.equal(center.incidents.length, 0);
  });
});
