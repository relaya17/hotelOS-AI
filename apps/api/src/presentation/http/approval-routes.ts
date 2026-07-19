import { Hono } from "hono";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  HotelRepository,
  KashrutRepository,
  MaintenanceRepository,
  OpsRepository,
  ProcurementRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import {
  evaluateKashrutProcurementGate,
  kashrutGateAllowsApprove,
} from "../../application/evaluate-kashrut-procurement-gate.js";
import { executeApprovalAct } from "../../application/execute-approval-act.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type ApprovalRouteDeps = {
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly ops: OpsRepository;
  readonly procurement: ProcurementRepository;
  readonly maintenance: MaintenanceRepository;
  readonly hotels: HotelRepository;
  readonly kashrut: KashrutRepository;
  readonly tokens: JwtTokenService;
};

const decideSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  kashrutAcknowledged: z.boolean().optional(),
  kashrutOverrideBlock: z.boolean().optional(),
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

  routes.get("/:id/kashrut-gate", async (c) => {
    try {
      const principal = c.get("principal");
      const approval = await deps.approvals.getById(
        principal.scope.tenantId,
        c.req.param("id"),
      );
      if (!approval || approval.status !== "pending") {
        return sendError(
          c,
          404,
          "APPROVAL_NOT_FOUND",
          "Pending approval not found",
        );
      }
      const gate = await buildKashrutGate(deps, approval);
      return c.json({ data: gate });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      const body = decideSchema.parse(await c.req.json());
      const approvalId = c.req.param("id");
      const pending = await deps.approvals.getById(
        principal.scope.tenantId,
        approvalId,
      );
      if (!pending || pending.status !== "pending") {
        return sendError(
          c,
          404,
          "APPROVAL_NOT_FOUND",
          "Pending approval not found",
        );
      }

      if (body.status === "approved") {
        const gate = await buildKashrutGate(deps, pending);
        const allowed = kashrutGateAllowsApprove(gate, {
          ...(body.kashrutAcknowledged !== undefined
            ? { kashrutAcknowledged: body.kashrutAcknowledged }
            : {}),
          ...(body.kashrutOverrideBlock !== undefined
            ? { kashrutOverrideBlock: body.kashrutOverrideBlock }
            : {}),
        });
        if (!allowed.ok) {
          return sendError(
            c,
            409,
            "KASHRUT_GATE_REQUIRED",
            allowed.reasonHe,
            { gate },
          );
        }
      }

      const now = new Date().toISOString();
      const updated = await deps.approvals.decide(
        principal.scope.tenantId,
        approvalId,
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
          ...(body.kashrutAcknowledged === true
            ? { kashrutAcknowledged: true }
            : {}),
          ...(body.kashrutOverrideBlock === true
            ? { kashrutOverrideBlock: true }
            : {}),
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

async function buildKashrutGate(
  deps: ApprovalRouteDeps,
  approval: Awaited<ReturnType<ApprovalRepository["getById"]>>,
) {
  if (!approval) {
    throw new Error("APPROVAL_REQUIRED");
  }
  let kashrutEnabled = false;
  if (approval.hotelId) {
    const hotels = await deps.hotels.listByTenant(
      Ids.tenant(approval.tenantId),
    );
    kashrutEnabled =
      hotels.find((h) => h.id === approval.hotelId)?.kashrutEnabled ?? false;
  }
  const annotations = approval.hotelId
    ? await deps.kashrut.listByTarget(
        Ids.tenant(approval.tenantId),
        "procurement",
        approval.id,
      )
    : [];
  return evaluateKashrutProcurementGate({
    approval,
    kashrutEnabled,
    annotations,
  });
}
