import { and, desc, eq } from "drizzle-orm";
import type { HotelId, TenantId } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { departments, users } from "../schema/tenancy.js";
import { departmentTasks } from "../schema/ops.js";

export const STANDARD_DEPARTMENTS: readonly {
  readonly code: string;
  readonly name: string;
}[] = [
  { code: "front_office", name: "קבלה / אירוח" },
  { code: "housekeeping", name: "משק בית" },
  { code: "fb", name: "מזון ומשקאות (F&B)" },
  { code: "maintenance", name: "תחזוקה והנדסה" },
  { code: "procurement", name: "רכש" },
  { code: "sales_marketing", name: "מכירות ושיווק" },
  { code: "finance", name: "כספים" },
  { code: "hr", name: "משאבי אנוש" },
  { code: "security", name: "אבטחה" },
  { code: "spa_recreation", name: "ספא ופנאי" },
  { code: "it", name: "IT" },
];

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "cancelled";

export type PersistedDepartment = {
  readonly id: string;
  readonly hotelId: string;
  readonly code: string;
  readonly name: string;
};

export type PersistedDepartmentTask = {
  readonly id: string;
  readonly tenantId: string;
  readonly hotelId: string;
  readonly departmentId: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly assignedToUserId: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateDepartmentTaskInput = {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly hotelId: HotelId;
  readonly departmentId: string;
  readonly taskType: string;
  readonly title: string;
  readonly description: string;
  readonly priority: TaskPriority;
  readonly createdByUserId?: string;
  readonly assignedToUserId?: string;
  readonly dueAt?: string;
  readonly createdAt: string;
};

function mapTask(row: typeof departmentTasks.$inferSelect): PersistedDepartmentTask {
  return {
    id: row.id,
    tenantId: row.tenantId,
    hotelId: row.hotelId,
    departmentId: row.departmentId,
    taskType: row.taskType,
    title: row.title,
    description: row.description,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    assignedToUserId: row.assignedToUserId ?? null,
    dueAt: row.dueAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type OpsRepository = {
  ensureStandardDepartments: (
    tenantId: TenantId,
    hotelId: HotelId,
    createdAt: string,
  ) => Promise<void>;
  listDepartments: (
    tenantId: TenantId,
    hotelId: HotelId,
  ) => Promise<readonly PersistedDepartment[]>;
  findDepartmentByCode: (
    tenantId: TenantId,
    hotelId: HotelId,
    code: string,
  ) => Promise<PersistedDepartment | null>;
  listTasksByDepartment: (
    tenantId: TenantId,
    hotelId: HotelId,
    departmentId: string,
  ) => Promise<readonly PersistedDepartmentTask[]>;
  createTask: (input: CreateDepartmentTaskInput) => Promise<PersistedDepartmentTask>;
  updateTaskStatus: (
    tenantId: TenantId,
    taskId: string,
    status: TaskStatus,
    updatedAt: string,
  ) => Promise<PersistedDepartmentTask | null>;
  countStaffByDepartment: (departmentId: string) => Promise<number>;
};

export function createOpsRepository(db: HotelOsDb): OpsRepository {
  return {
    async ensureStandardDepartments(tenantId, hotelId, createdAt) {
      const existing = await db
        .select()
        .from(departments)
        .where(
          and(eq(departments.tenantId, tenantId), eq(departments.hotelId, hotelId)),
        )
        .all();
      const existingCodes = new Set(existing.map((row) => row.code));

      for (const dept of STANDARD_DEPARTMENTS) {
        if (existingCodes.has(dept.code)) {
          continue;
        }
        await db.insert(departments)
          .values({
            id: crypto.randomUUID(),
            tenantId,
            hotelId,
            code: dept.code,
            name: dept.name,
            createdAt,
          })
          .run();
      }
    },

    async listDepartments(tenantId, hotelId) {
      const rows = await db
        .select()
        .from(departments)
        .where(
          and(eq(departments.tenantId, tenantId), eq(departments.hotelId, hotelId)),
        )
        .all();
      return rows.map((row) => ({
        id: row.id,
        hotelId: row.hotelId,
        code: row.code,
        name: row.name,
      }));
    },

    async findDepartmentByCode(tenantId, hotelId, code) {
      const row = await db
        .select()
        .from(departments)
        .where(
          and(
            eq(departments.tenantId, tenantId),
            eq(departments.hotelId, hotelId),
            eq(departments.code, code),
          ),
        )
        .get();
      if (!row) {
        return null;
      }
      return { id: row.id, hotelId: row.hotelId, code: row.code, name: row.name };
    },

    async listTasksByDepartment(tenantId, hotelId, departmentId) {
      const rows = await db
        .select()
        .from(departmentTasks)
        .where(
          and(
            eq(departmentTasks.tenantId, tenantId),
            eq(departmentTasks.hotelId, hotelId),
            eq(departmentTasks.departmentId, departmentId),
          ),
        )
        .orderBy(desc(departmentTasks.createdAt))
        .all();
      return rows.map(mapTask);
    },

    async createTask(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        hotelId: input.hotelId,
        departmentId: input.departmentId,
        taskType: input.taskType,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "open" as const,
        createdByUserId: input.createdByUserId ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        dueAt: input.dueAt ?? null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
        closedAt: null,
      };
      await db.insert(departmentTasks).values(row).run();
      return mapTask(row);
    },

    async updateTaskStatus(tenantId, taskId, status, updatedAt) {
      await db.update(departmentTasks)
        .set({
          status,
          updatedAt,
          ...(status === "done" || status === "cancelled" ? { closedAt: updatedAt } : {}),
        })
        .where(and(eq(departmentTasks.id, taskId), eq(departmentTasks.tenantId, tenantId)))
        .run();

      const row = await db
        .select()
        .from(departmentTasks)
        .where(eq(departmentTasks.id, taskId))
        .get();
      return row ? mapTask(row) : null;
    },

    async countStaffByDepartment(departmentId) {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.departmentId, departmentId))
        .all();
      return rows.length;
    },
  };
}
