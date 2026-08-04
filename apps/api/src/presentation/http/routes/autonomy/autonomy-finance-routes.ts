import { Hono } from "hono";
import {
  canAccessHotel,
  canApproveLedgerClose,
  canDecideOpsHitl,
} from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError, sendError } from "../../errors.js";
import { suggestLedgerCloseSchema } from "./autonomy-schemas.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { AutonomyRouteDeps } from "./autonomy-deps.js";

export function createAutonomyFinanceRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();



    /**
     * Suggest ledger close for a fiscal month — stage ז׳ HITL.
     * Full human-in-the-loop: Act never runs without accountant/CFO Approve
     * (see `canApproveLedgerClose`); admin alone is not enough there.
     */
    routes.post("/suggest-ledger-close", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestLedgerCloseSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        if (!canAccessHotel(principal, hotelId)) {
          return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
        }
        if (!canApproveLedgerClose(principal) && !canDecideOpsHitl(principal)) {
          return sendError(
            c,
            403,
            "ROLE_REQUIRED",
            "Ledger-close Suggest requires an accountant/CFO or ops/management role",
          );
        }
        const now = new Date().toISOString();

        const period = await deps.turbo.ensureAccountingPeriod({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          periodKey: body.periodKey,
          createdAt: now,
        });
        if (period.status === "closed") {
          return sendError(
            c,
            409,
            "PERIOD_ALREADY_CLOSED",
            `Period ${body.periodKey} is already closed`,
          );
        }
        if (period.status === "pending_close") {
          return sendError(
            c,
            409,
            "PERIOD_PENDING_CLOSE",
            `Period ${body.periodKey} already has a pending close approval`,
          );
        }

        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe: `סגירת ספרים לחודש ${body.periodKey}`,
          reasonHe:
            "הצעת agent.cfo — נדרש אישור רואה חשבון/CFO לפני סגירת תקופה חשבונאית (HITL מלא; אין ביצוע כספי אוטונומי).",
          payloadJson: JSON.stringify({
            kind: "autonomy.ledger_close",
            hotelId: body.hotelId,
            periodKey: body.periodKey,
          }),
          createdAt: now,
        });

        const marked = await deps.turbo.markAccountingPeriodPendingClose({
          tenantId: principal.scope.tenantId,
          periodKey: body.periodKey,
          approvalId: created.id,
          updatedAt: now,
        });
        if (!marked) {
          return sendError(
            c,
            500,
            "PERIOD_UPDATE_FAILED",
            "Failed to mark period pending close",
          );
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest_ledger_close",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            periodKey: body.periodKey,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              period: marked,
              autonomyStep: "suggest",
              nextStepHe:
                "Approve בתיבת אישורי AI (רואה חשבון/CFO בלבד) → Act יסגור את התקופה + משימת מעקב כספים",
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
