import type {
  HotelRepository,
  MaintenanceRepository,
  OpsRepository,
  PersistedDepartmentTask,
  TaskPriority,
  TaskStatus,
} from "@hotelos/database";
import type { HotelId, TenantId } from "@hotelos/shared";

export type IncidentSeverity = TaskPriority;
export type IncidentDepartment = "security" | "it" | "maintenance";

export type IncidentDto = {
  readonly id: string;
  readonly hotelId: string;
  readonly hotelName: string;
  readonly department: IncidentDepartment;
  readonly severity: IncidentSeverity;
  readonly title: string;
  readonly source: string;
  readonly createdAt: string;
  readonly status: string;
  readonly taskId: string | null;
};

export type IncidentCenter = {
  readonly generatedAt: string;
  readonly incidents: readonly IncidentDto[];
};

const INCIDENT_DEPARTMENT_CODES: readonly IncidentDepartment[] = [
  "security",
  "it",
  "maintenance",
];

const INCIDENT_TASK_TYPES = new Set([
  "security_event",
  "error_event",
  "anomaly_alert",
  "critical_maintenance",
  "incident",
  "safety_event",
]);

const OPEN_TASK_STATUSES = new Set<TaskStatus>([
  "open",
  "in_progress",
  "blocked",
]);

const OPEN_MAINTENANCE_STATUSES = new Set([
  "open",
  "quote_requested",
  "approved",
  "in_progress",
]);

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export type BuildIncidentCenterDeps = {
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly hotels: HotelRepository;
};

function isOpenIncidentTask(task: PersistedDepartmentTask): boolean {
  if (!OPEN_TASK_STATUSES.has(task.status)) {
    return false;
  }
  if (task.priority === "high" || task.priority === "urgent") {
    return true;
  }
  return INCIDENT_TASK_TYPES.has(task.taskType);
}

function incidentSource(task: PersistedDepartmentTask): string {
  if (INCIDENT_TASK_TYPES.has(task.taskType)) {
    return task.taskType;
  }
  return "department_task";
}

function compareIncidents(a: IncidentDto, b: IncidentDto): number {
  const severityDelta = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Aggregates open security, IT, and critical maintenance signals from
 * `department_tasks` and urgent `maintenance_requests` — no new silo table.
 */
export async function buildIncidentCenter(
  deps: BuildIncidentCenterDeps,
  tenantId: TenantId,
  hotelIds: readonly HotelId[],
): Promise<IncidentCenter> {
  const hotelRows = await deps.hotels.listByTenant(tenantId);
  const allowed = new Set(hotelIds.map((id) => id as string));
  const scopedHotels = hotelRows.filter((hotel) => allowed.has(hotel.id));
  const now = new Date().toISOString();
  const incidents: IncidentDto[] = [];

  for (const hotel of scopedHotels) {
    const hotelId = hotel.id;
    await deps.ops.ensureStandardDepartments(tenantId, hotelId, now);

    for (const code of INCIDENT_DEPARTMENT_CODES) {
      const dept = await deps.ops.findDepartmentByCode(tenantId, hotelId, code);
      if (!dept) {
        continue;
      }
      const tasks = await deps.ops.listTasksByDepartment(
        tenantId,
        hotelId,
        dept.id,
      );
      for (const task of tasks) {
        if (!isOpenIncidentTask(task)) {
          continue;
        }
        incidents.push({
          id: `task:${task.id}`,
          hotelId: hotel.id,
          hotelName: hotel.name,
          department: code,
          severity: task.priority,
          title: task.title,
          source: incidentSource(task),
          createdAt: task.createdAt,
          status: task.status,
          taskId: task.id,
        });
      }
    }

    const requests = await deps.maintenance.listByHotel(tenantId, hotelId);
    for (const request of requests) {
      if (!OPEN_MAINTENANCE_STATUSES.has(request.status)) {
        continue;
      }
      if (request.priority !== "high" && request.priority !== "urgent") {
        continue;
      }
      incidents.push({
        id: `maint:${request.id}`,
        hotelId: hotel.id,
        hotelName: hotel.name,
        department: "maintenance",
        severity: request.priority,
        title: request.title,
        source: "maintenance_request",
        createdAt: request.createdAt,
        status: request.status,
        taskId: request.id,
      });
    }
  }

  incidents.sort(compareIncidents);

  return {
    generatedAt: now,
    incidents,
  };
}
