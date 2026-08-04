import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  canAccessHotel,
  canApproveMoneyAmount,
  canDecideOpsHitl,
  canOperateProcurement,
} from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import type { AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { OpsRouteDeps } from "./ops-deps.js";
import { createResolveOpsHotelId, hotelIdSchema, type OpsContext } from "./ops-hotel.js";

import {
  createTaskSchema,
  updateTaskStatusSchema,
} from "./ops-schemas.js";


export function createOpsDepartmentsRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Departments + generic tasks ----

  routes.get("/departments", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.ops.listDepartments(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      const withStaff = await Promise.all(
        list.map(async (dept) => ({
          ...dept,
          staffCount: await deps.ops.countStaffByDepartment(dept.id),
        })),
      );
      return c.json({ data: withStaff });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/departments/:code/tasks", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const code = c.req.param("code");
      const department = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        resolved.hotelId,
        code,
      );
      if (!department) {
        return sendError(c, 404, "DEPARTMENT_NOT_FOUND", "Department not found");
      }
      const tasks = await deps.ops.listTasksByDepartment(
        principal.scope.tenantId,
        resolved.hotelId,
        department.id,
      );
      return c.json({ data: { department, tasks } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/departments/:code/tasks", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const code = c.req.param("code");
      const department = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        resolved.hotelId,
        code,
      );
      if (!department) {
        return sendError(c, 404, "DEPARTMENT_NOT_FOUND", "Department not found");
      }
      const body = createTaskSchema.parse(await c.req.json());
      const created = await deps.ops.createTask({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        departmentId: department.id,
        taskType: body.taskType,
        title: body.title,
        description: body.description,
        priority: body.priority,
        createdByUserId: principal.userId,
        ...(body.dueAt ? { dueAt: body.dueAt } : {}),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/tasks/:id", async (c) => {
    try {
      const principal = c.get("principal");
      const taskId = c.req.param("id");
      const body = updateTaskStatusSchema.parse(await c.req.json());
      const now = new Date().toISOString();

      if (body.release === true) {
        const released = await deps.ops.releaseTask(
          principal.scope.tenantId,
          taskId,
          principal.userId,
          now,
        );
        if (!released.ok) {
          if (released.reason === "NOT_FOUND") {
            return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
          }
          if (released.reason === "NOT_ASSIGNED") {
            return sendError(
              c,
              409,
              "TASK_NOT_ASSIGNED",
              "Task is not currently assigned",
            );
          }
          return sendError(
            c,
            403,
            "TASK_NOT_OWNER",
            "Only the assignee can release this task",
          );
        }
        if (body.status !== undefined && body.status !== released.task.status) {
          const updated = await deps.ops.updateTaskStatus(
            principal.scope.tenantId,
            taskId,
            body.status,
            now,
          );
          if (!updated) {
            return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
          }
          return c.json({ data: updated });
        }
        return c.json({ data: released.task });
      }

      if (body.claim === true) {
        const claimed = await deps.ops.claimTask(
          principal.scope.tenantId,
          taskId,
          principal.userId,
          now,
        );
        if (!claimed.ok) {
          if (claimed.reason === "NOT_FOUND") {
            return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
          }
          return sendError(
            c,
            409,
            "TASK_ALREADY_CLAIMED",
            "Task is already assigned to another user",
          );
        }
        if (body.status !== undefined && body.status !== claimed.task.status) {
          const updated = await deps.ops.updateTaskStatus(
            principal.scope.tenantId,
            taskId,
            body.status,
            now,
          );
          if (!updated) {
            return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
          }
          return c.json({ data: updated });
        }
        return c.json({ data: claimed.task });
      }

      const updated = await deps.ops.updateTaskStatus(
        principal.scope.tenantId,
        taskId,
        body.status!,
        now,
      );
      if (!updated) {
        return sendError(c, 404, "TASK_NOT_FOUND", "Task not found");
      }
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
