import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  createGoalSchema,
  roomIdSchema,
  updateGoalStatusSchema,
} from "./briefing-schemas.js";
import { resolveDisplayName, toGoalDto } from "./briefing-dto.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { BriefingRouteDeps } from "./briefing-deps.js";

export function createBriefingGoalsRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/:roomId/goals", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const body = createGoalSchema.parse(await c.req.json());
        const ownerDisplayName =
          body.ownerDisplayName ??
          (await resolveDisplayName(deps.users, principal.userId));

        const goal = await deps.briefing.createGoal({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          roomId,
          title: body.title,
          description: body.description,
          ownerDisplayName,
          ...(body.ownerUserId !== undefined
            ? { ownerUserId: Ids.user(body.ownerUserId) }
            : {}),
          ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
          source: "manual",
          createdAt: new Date().toISOString(),
        });
        if (!goal) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.goal.create",
          resourceType: "briefing_goal",
          resourceId: goal.id,
          metadata: { roomId, source: "manual" },
          createdAt: new Date().toISOString(),
        });

        return c.json({ data: toGoalDto(goal) }, 201);
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.patch("/:roomId/goals/:goalId", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const goalId = roomIdSchema.parse(c.req.param("goalId"));
        const body = updateGoalStatusSchema.parse(await c.req.json());

        const goal = await deps.briefing.updateGoalStatus({
          tenantId: principal.scope.tenantId,
          roomId,
          goalId,
          status: body.status,
        });
        if (!goal) {
          return sendError(c, 404, "GOAL_NOT_FOUND", "יעד לא נמצא");
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.goal.update",
          resourceType: "briefing_goal",
          resourceId: goal.id,
          metadata: { roomId, status: body.status },
          createdAt: new Date().toISOString(),
        });

        return c.json({ data: toGoalDto(goal) });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  return routes;
}
