import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  MaintenanceRepository,
  OpsRepository,
  ProcurementRepository,
} from "@hotelos/database";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { executeApprovalAct } from "../../application/execute-approval-act.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type ApprovalRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
  readonly maintenance: MaintenanceRepository;
  readonly tokens: JwtTokenService;
};

const decideSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});

export function createApprovalRoutes(deps: ApprovalRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/pending", async (c) => {
    try {
      const principal = c.get("principal");
      const data = await deps.approvals.listPending(principal.scope.tenantId);
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      const body = decideSchema.parse(await c.req.json());
      const now = new Date().toISOString();
      const updated = await deps.approvals.decide(
        principal.scope.tenantId,
        c.req.param("id"),
        body.status,
        principal.userId,
        now,
      );
      if (!updated) {
        return sendError(
          c,
          404,
          "APPROVAL_NOT_FOUND",
          "Pending approval not found",
        );
      }

      const act =
        body.status === "approved"
          ? await executeApprovalAct(
              {
                ops: deps.ops,
                procurement: deps.procurement,
                maintenance: deps.maintenance,
              },
              updated,
              principal.userId,
              now,
            )
          : ({
              status: "skipped" as const,
              reasonHe: "נדחה — לא בוצע Act.",
            } as const);

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: `ai.approval.${body.status}`,
        resourceType: "ai_approval_request",
        resourceId: updated.id,
        metadata: {
          agentId: updated.agentId,
          actStatus: act.status,
          ...(act.status === "executed"
            ? {
                actAction: act.action,
                actResourceId: act.resourceId,
              }
            : {}),
        },
        createdAt: now,
      });

      if (act.status === "executed") {
        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.act",
          resourceType: act.resourceType,
          resourceId: act.resourceId,
          metadata: {
            approvalId: updated.id,
            agentId: updated.agentId,
            actAction: act.action,
          },
          createdAt: now,
        });
      }

      return c.json({ data: updated, act });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
