import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  OpsRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError } from "./errors.js";

export type AutonomyRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly tokens: JwtTokenService;
};

const suggestDepartmentTaskSchema = z.object({
  kind: z.literal("department_task"),
  hotelId: z.string().uuid(),
  departmentCode: z.string().trim().min(2).max(40),
  taskType: z.string().trim().min(1).max(60),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  agentId: z.string().trim().min(3).max(80).default("agent.cio"),
  summaryHe: z.string().trim().min(2).max(240).optional(),
  reasonHe: z.string().trim().min(2).max(500).optional(),
});

/**
 * Autonomy Suggest — creates a pending AI approval (HITL) before Act.
 */
export function createAutonomyRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.post("/suggest", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestDepartmentTaskSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      const now = new Date().toISOString();

      await deps.ops.ensureStandardDepartments(
        principal.scope.tenantId,
        hotelId,
        now,
      );
      const department = await deps.ops.findDepartmentByCode(
        principal.scope.tenantId,
        hotelId,
        body.departmentCode,
      );
      if (!department) {
        return c.json(
          {
            error: {
              code: "DEPARTMENT_NOT_FOUND",
              message: `Department ${body.departmentCode} not found`,
            },
          },
          404,
        );
      }

      const summaryHe =
        body.summaryHe ?? `הצעת משימה: ${body.title} (${body.departmentCode})`;
      const reasonHe =
        body.reasonHe ??
        "הצעת סוכן AI — נדרש אישור אנושי לפני פתיחת משימה במחלקה.";

      const created = await deps.approvals.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        agentId: body.agentId,
        requestedByUserId: principal.userId,
        summaryHe,
        reasonHe,
        payloadJson: JSON.stringify({
          kind: "autonomy.department_task",
          hotelId: body.hotelId,
          departmentCode: body.departmentCode,
          taskType: body.taskType,
          title: body.title,
          description: body.description,
          priority: body.priority,
        }),
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "autonomy.suggest",
        resourceType: "ai_approval_request",
        resourceId: created.id,
        metadata: {
          kind: body.kind,
          departmentCode: body.departmentCode,
          agentId: body.agentId,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            approval: created,
            autonomyStep: "suggest",
            nextStepHe: "Approve בתיבת אישורי AI → Act ייפתח משימה במחלקה",
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
