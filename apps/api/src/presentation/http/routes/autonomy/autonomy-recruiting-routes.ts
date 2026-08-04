import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError, sendError } from "../../errors.js";
import { assertAutonomyAccess } from "./autonomy-access.js";
import { suggestRecruitingStageSchema } from "./autonomy-schemas.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { AutonomyRouteDeps } from "./autonomy-deps.js";

export function createAutonomyRecruitingRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();



    /** Suggest offer/hired stage change (HITL before Act). */
    routes.post("/suggest-recruiting-stage", async (c) => {
      try {
        const principal = c.get("principal");
        const body = suggestRecruitingStageSchema.parse(await c.req.json());
        const hotelId = Ids.hotel(body.hotelId);
        const denied = assertAutonomyAccess(c, principal, hotelId, false);
        if (denied) return denied;
        const now = new Date().toISOString();

        const found = await deps.recruiting.findCandidateInHotel(
          principal.scope.tenantId,
          hotelId,
          body.candidateId,
        );
        if (!found) {
          return sendError(
            c,
            404,
            "CANDIDATE_NOT_FOUND",
            "Candidate not found",
          );
        }
        if (found.posting.status === "closed") {
          return sendError(
            c,
            409,
            "POSTING_CLOSED",
            "Cannot advance candidates on a closed posting",
          );
        }
        if (found.candidate.stage === body.stage) {
          return sendError(
            c,
            409,
            "STAGE_UNCHANGED",
            `Candidate is already in stage ${body.stage}`,
          );
        }

        const stageHe = body.stage === "hired" ? "התקבל/ה" : "הצעה נשלחה";
        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: body.agentId,
          requestedByUserId: principal.userId,
          summaryHe: `${stageHe}: ${found.candidate.fullName} · ${found.posting.title}`,
          reasonHe:
            body.stage === "hired"
              ? "הצעת agent.hr — נדרש אישור מפקח לפני סימון מועמד כהתקבל (ללא יצירת משתמש/חוזה אוטומטי)."
              : "הצעת agent.hr — נדרש אישור מפקח לפני סימון שליחת הצעת עבודה.",
          payloadJson: JSON.stringify({
            kind: "autonomy.recruiting_stage",
            hotelId: body.hotelId,
            candidateId: found.candidate.id,
            jobPostingId: found.posting.id,
            postingTitle: found.posting.title,
            candidateName: found.candidate.fullName,
            fromStage: found.candidate.stage,
            stage: body.stage,
          }),
          createdAt: now,
        });

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "autonomy.suggest_recruiting_stage",
          resourceType: "ai_approval_request",
          resourceId: created.id,
          metadata: {
            candidateId: found.candidate.id,
            stage: body.stage,
            agentId: body.agentId,
          },
          createdAt: now,
        });

        return c.json(
          {
            data: {
              approval: created,
              autonomyStep: "suggest",
              candidateId: found.candidate.id,
              stage: body.stage,
              nextStepHe:
                "Approve בתיבת אישורי AI → Act יעדכן שלב מועמד (+ משימת מעקב HR)",
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
