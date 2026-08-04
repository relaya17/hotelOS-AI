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
  addCandidateSchema,
  createJobPostingSchema,
  updateCandidateStageSchema,
} from "./ops-schemas.js";


export function createOpsRecruitingRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- HR recruiting (job board tracker) ----

  routes.get("/recruiting/postings", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const list = await deps.recruiting.listPostings(
        principal.scope.tenantId,
        resolved.hotelId,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = createJobPostingSchema.parse(await c.req.json());
      const created = await deps.recruiting.createPosting({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        title: body.title,
        boardName: body.boardName,
        ...(body.externalUrl ? { externalUrl: body.externalUrl } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
        createdByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.posting.create",
        resourceType: "job_posting",
        resourceId: created.id,
        metadata: {
          title: created.title,
          boardName: created.boardName,
          status: created.status,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings/:id/candidates", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const posting = await deps.recruiting.findPostingInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
      );
      if (!posting) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      if (posting.status === "closed") {
        return sendError(
          c,
          409,
          "POSTING_CLOSED",
          "Cannot add candidates to a closed posting",
        );
      }
      const body = addCandidateSchema.parse(await c.req.json());
      const created = await deps.recruiting.addCandidate({
        id: randomUUID(),
        jobPostingId: postingId,
        fullName: body.fullName,
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.email ? { email: body.email } : {}),
        source: body.source,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.candidate.create",
        resourceType: "job_candidate",
        resourceId: created.id,
        metadata: {
          jobPostingId: created.jobPostingId,
          source: created.source,
          stage: created.stage,
        },
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/recruiting/postings/:id/candidates", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const posting = await deps.recruiting.findPostingInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
      );
      if (!posting) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      const list = await deps.recruiting.listCandidates(postingId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/recruiting/postings/:id/close", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const postingId = c.req.param("id");
      const now = new Date().toISOString();
      const closed = await deps.recruiting.closePosting(
        principal.scope.tenantId,
        resolved.hotelId,
        postingId,
        now,
      );
      if (!closed) {
        return sendError(c, 404, "POSTING_NOT_FOUND", "Job posting not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.posting.close",
        resourceType: "job_posting",
        resourceId: closed.id,
        metadata: { title: closed.title, status: closed.status },
        createdAt: now,
      });
      return c.json({ data: closed });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.patch("/recruiting/candidates/:candidateId/stage", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;
      const body = updateCandidateStageSchema.parse(await c.req.json());
      const found = await deps.recruiting.findCandidateInHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        c.req.param("candidateId"),
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
          "Cannot update candidates on a closed posting",
        );
      }
      const updated = await deps.recruiting.updateCandidateStage(
        found.candidate.id,
        body.stage,
      );
      if (!updated) {
        return sendError(
          c,
          404,
          "CANDIDATE_NOT_FOUND",
          "Candidate not found",
        );
      }
      const now = new Date().toISOString();
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "recruiting.candidate.stage",
        resourceType: "job_candidate",
        resourceId: updated.id,
        metadata: {
          jobPostingId: updated.jobPostingId,
          from: found.candidate.stage,
          to: updated.stage,
        },
        createdAt: now,
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
