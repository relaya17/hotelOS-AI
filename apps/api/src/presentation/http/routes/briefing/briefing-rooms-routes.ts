import { Hono } from "hono";
import { MEETING_POLICY_VERSION } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { endBriefingWithSecretary } from "../../../../application/end-briefing-with-secretary.js";
import { mapUnknownError, sendError } from "../../errors.js";
import {
  createRoomSchema,
  joinRoomSchema,
  recordingConsentSchema,
  roomIdSchema,
} from "./briefing-schemas.js";
import {
  resolveDisplayName,
  toAttendanceDto,
  toDetailDto,
  toGoalDto,
  toRoomDto,
  toSummaryDto,
} from "./briefing-dto.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { BriefingRouteDeps } from "./briefing-deps.js";

export function createBriefingRoomsRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.get("/", async (c) => {
      try {
        const principal = c.get("principal");
        const rooms = await deps.briefing.listByTenant(principal.scope.tenantId);
        return c.json({
          data: rooms.map((room) => ({
            id: room.id,
            title: room.title,
            purpose: room.purpose,
            status: room.status,
            hostUserId: room.hostUserId,
            chainId: room.chainId,
            roomKind: room.roomKind,
            inviteToken: room.inviteToken,
            policyVersion: room.policyVersion,
            createdAt: room.createdAt,
          })),
        });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/", async (c) => {
      try {
        const principal = c.get("principal");
        const body = createRoomSchema.parse(await c.req.json());
        const chainId = principal.scope.chainId;
        if (!chainId) {
          return sendError(
            c,
            400,
            "CHAIN_REQUIRED",
            "Chain scope required to create briefing rooms",
          );
        }

        const hostName = await resolveDisplayName(deps.users, principal.userId);
        const room = await deps.briefing.create({
          id: Ids.briefingRoom(randomUUID()),
          tenantId: principal.scope.tenantId,
          chainId,
          title: body.title,
          purpose: body.purpose,
          roomKind: body.roomKind,
          hostUserId: principal.userId,
          createdAt: new Date().toISOString(),
          participants: [
            {
              id: randomUUID(),
              displayName: hostName,
              roleLabel: "מארח / מנהל אזור",
              userId: principal.userId,
            },
            ...body.participants.map((participant) => ({
              id: randomUUID(),
              displayName: participant.displayName,
              roleLabel: participant.roleLabel,
            })),
          ],
        });
        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.room.create",
          resourceType: "briefing_room",
          resourceId: room.id,
          metadata: {
            purpose: room.purpose,
            roomKind: room.roomKind,
            participantCount: body.participants.length + 1,
          },
          createdAt: new Date().toISOString(),
        });
        return c.json(
          {
            data: {
              id: room.id,
              title: room.title,
              purpose: room.purpose,
              status: room.status,
              hostUserId: room.hostUserId,
              chainId: room.chainId,
              roomKind: room.roomKind,
              inviteToken: room.inviteToken,
              policyVersion: room.policyVersion,
              createdAt: room.createdAt,
            },
          },
          201,
        );
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/join", async (c) => {
      try {
        const principal = c.get("principal");
        const body = joinRoomSchema.parse(await c.req.json());
        const room = await deps.briefing.findByInviteToken(
          principal.scope.tenantId,
          body.inviteToken,
        );
        if (!room) {
          return sendError(
            c,
            404,
            "INVITE_NOT_FOUND",
            "קישור הזמנה לפגישה לא נמצא",
          );
        }

        const displayName = await resolveDisplayName(deps.users, principal.userId);
        const attendance = await deps.briefing.joinRoom({
          roomId: room.id,
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
          displayName,
        });
        if (!attendance) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.room.join",
          resourceType: "briefing_room",
          resourceId: room.id,
          metadata: { inviteToken: body.inviteToken },
          createdAt: new Date().toISOString(),
        });

        return c.json({
          data: {
            room: toRoomDto(room),
            attendance: toAttendanceDto(attendance),
          },
        });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.get("/:roomId", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const detail = await deps.briefing.getDetail(
          principal.scope.tenantId,
          roomId,
        );
        if (!detail) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }
        return c.json({ data: toDetailDto(detail) });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/start", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const room = await deps.briefing.setStatus(
          principal.scope.tenantId,
          roomId,
          "live",
        );
        if (!room) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }
        return c.json({
          data: {
            id: room.id,
            status: room.status,
          },
        });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/end", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const result = await endBriefingWithSecretary(
          deps.agents,
          deps.briefing,
          deps.gateway,
          {
            tenantId: principal.scope.tenantId,
            roomId,
            actorUserId: principal.userId,
          },
        );
        if (!result.ok) {
          const status = result.error.code === "ROOM_NOT_FOUND" ? 404 : 400;
          return sendError(c, status, result.error.code, result.error.message);
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.room.end",
          resourceType: "briefing_room",
          resourceId: roomId,
          metadata: {
            summaryId: result.value.summary.id,
            idempotent: result.value.idempotent,
            goalCount: result.value.goals.length,
          },
          createdAt: new Date().toISOString(),
        });

        return c.json({
          data: {
            id: result.value.roomId,
            status: result.value.status,
            summary: toSummaryDto(result.value.summary),
            goals: result.value.goals.map(toGoalDto),
            idempotent: result.value.idempotent,
          },
        });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/leave", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const ok = await deps.briefing.leaveRoom({
          roomId,
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
        });
        if (!ok) {
          return sendError(
            c,
            404,
            "NOT_IN_ROOM",
            "לא נמצאה נוכחות פעילה בחדר",
          );
        }
        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.room.leave",
          resourceType: "briefing_room",
          resourceId: roomId,
          metadata: {},
          createdAt: new Date().toISOString(),
        });
        return c.json({ data: { ok: true } });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  routes.post("/:roomId/recording-consent", async (c) => {
      try {
        const principal = c.get("principal");
        const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
        const body = recordingConsentSchema.parse(await c.req.json());
        if (!body.accepted) {
          return sendError(
            c,
            400,
            "CONSENT_REQUIRED",
            "יש לאשר את מדיניות ההקלטה",
          );
        }

        const detail = await deps.briefing.getDetail(
          principal.scope.tenantId,
          roomId,
        );
        if (!detail) {
          return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
        }
        if (detail.room.policyVersion !== MEETING_POLICY_VERSION) {
          return sendError(
            c,
            409,
            "POLICY_VERSION_MISMATCH",
            "גרסת מדיניות הפגישה אינה תואמת — יש לרענן ולאשר מחדש",
          );
        }

        const ok = await deps.briefing.recordRecordingConsent({
          roomId,
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
          policyVersion: MEETING_POLICY_VERSION,
        });
        if (!ok) {
          return sendError(
            c,
            404,
            "NOT_IN_ROOM",
            "יש להצטרף לחדר לפני מתן הסכמה להקלטה",
          );
        }

        await deps.audit.append({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          actorUserId: principal.userId,
          action: "briefing.recording.consent",
          resourceType: "briefing_room",
          resourceId: roomId,
          metadata: { policyVersion: MEETING_POLICY_VERSION },
          createdAt: new Date().toISOString(),
        });

        return c.json({
          data: {
            ok: true,
            policyVersion: MEETING_POLICY_VERSION,
          },
        });
      } catch (error) {
        return mapUnknownError(c, error);
      }
    });

  return routes;
}
