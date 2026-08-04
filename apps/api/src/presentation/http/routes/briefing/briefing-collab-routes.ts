import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { consultBriefingAgent } from "../../../../application/consult-briefing-agent.js";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  consultSchema,
  messageSchema,
  roomIdSchema,
  shareAgentSchema,
} from "./briefing-schemas.js";
import { resolveDisplayName } from "./briefing-dto.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { BriefingRouteDeps } from "./briefing-deps.js";

export function createBriefingCollabRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/:roomId/agents", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const body = shareAgentSchema.parse(await c.req.json());
        const agentId = Ids.agent(body.agentId);
        const agent = await deps.agents.findById(agentId);
        if (!agent) {
          return sendError(c, 404, "AGENT_NOT_FOUND", "Agent not found");
        }

        const shared = await deps.briefing.shareAgent({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          roomId,
          agentId,
          sharedByUserId: principal.userId,
          sharedAt: new Date().toISOString(),
        });
        if (!shared) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }

        await deps.briefing.addMessage({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          roomId,
          speakerKind: "agent",
          speakerId: agent.id,
          speakerName: agent.nameHe,
          body: `${agent.nameHe} הצטרף לחדר הבריפינג וזמין לתדריך לוועדה.`,
          createdAt: new Date().toISOString(),
        });
        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.agent.share",
          resourceType: "briefing_shared_agent",
          resourceId: shared.id,
          metadata: {
            roomId,
            agentId: shared.agentId,
            domain: shared.domain,
          },
          createdAt: new Date().toISOString(),
        });

        return c.json(
          {
            data: {
              id: shared.id,
              agentId: shared.agentId,
              nameHe: shared.nameHe,
              nameEn: shared.nameEn,
              domain: shared.domain,
              summaryHe: shared.summaryHe,
              autonomyMode: shared.autonomyMode,
              sharedAt: shared.sharedAt,
            },
          },
          201,
        );
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.delete("/:roomId/agents/:agentId", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const agentId = Ids.agent(c.req.param("agentId"));
        const ok = await deps.briefing.unshareAgent(
          principal.scope.tenantId,
          roomId,
          agentId,
        );
        if (!ok) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }
        return c.json({ data: { ok: true } });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/messages", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const body = messageSchema.parse(await c.req.json());
        const speakerName = await resolveDisplayName(
          deps.users,
          principal.userId,
        );
        const message = await deps.briefing.addMessage({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          roomId,
          speakerKind: "human",
          speakerId: principal.userId,
          speakerName,
          body: body.body,
          createdAt: new Date().toISOString(),
        });
        if (!message) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }
        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.message.post",
          resourceType: "briefing_message",
          resourceId: message.id,
          metadata: {
            roomId,
            speakerKind: message.speakerKind,
            bodyLength: message.body.length,
          },
          createdAt: new Date().toISOString(),
        });
        return c.json({ data: message }, 201);
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/agents/:agentId/consult", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const agentId = Ids.agent(c.req.param("agentId"));
        const body = consultSchema.parse(await c.req.json().catch(() => ({})));
        const result = await consultBriefingAgent(
          deps.agents,
          deps.briefing,
          deps.overview,
          deps.gateway,
          {
            tenantId: principal.scope.tenantId,
            roomId,
            agentId,
            actorUserId: principal.userId,
            ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
          },
        );
        if (!result.ok) {
          const status =
            result.error.code === "AGENT_NOT_SHARED" ? 409 : 404;
          return sendError(
            c,
            status,
            result.error.code,
            result.error.message,
          );
        }
        if (result.value.requiresHumanApproval) {
          await deps.approvals.create({
            id: randomUUID(),
            tenantId: principal.scope.tenantId,
            agentId: String(agentId),
            requestedByUserId: principal.userId,
            summaryHe: result.value.body.slice(0, 280),
            reasonHe:
              result.value.approvalReasonHe ??
              "המלצת סוכן בבריפינג דורשת אישור אנושי",
            payloadJson: JSON.stringify({
              roomId: String(roomId),
              messageId: result.value.id,
            }),
            createdAt: new Date().toISOString(),
          });
        }
        return c.json({ data: result.value }, 201);
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  return routes;
}
