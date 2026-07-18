import { Hono } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  AgentRepository,
  ApprovalRepository,
  AuditRepository,
  BriefingRepository,
  OverviewRepository,
  UserRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { consultBriefingAgent } from "../../application/consult-briefing-agent.js";
import {
  extensionFromMime,
  type RecordingStorage,
} from "../../infrastructure/recording-storage.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type BriefingRouteDeps = {
  readonly audit: AuditRepository;
  readonly briefing: BriefingRepository;
  readonly agents: AgentRepository;
  readonly overview: OverviewRepository;
  readonly users: UserRepository;
  readonly tokens: JwtTokenService;
  readonly recordings: RecordingStorage;
  readonly gateway: AiGateway;
  readonly approvals: ApprovalRepository;
};

const roomIdSchema = z.string().uuid();
const createRoomSchema = z.object({
  title: z.string().trim().min(3).max(160),
  purpose: z.string().trim().min(2).max(80),
  participants: z
    .array(
      z.object({
        displayName: z.string().trim().min(2).max(120),
        roleLabel: z.string().trim().min(2).max(120),
      }),
    )
    .max(20)
    .default([]),
});

const shareAgentSchema = z.object({
  agentId: z.string().min(3).max(80),
});

const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const consultSchema = z.object({
  prompt: z.string().trim().max(500).optional(),
});

export function createBriefingRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

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
            createdAt: room.createdAt,
          },
        },
        201,
      );
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
      const room = await deps.briefing.setStatus(
        principal.scope.tenantId,
        roomId,
        "ended",
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

  routes.get("/:roomId/recordings", async (c) => {
    try {
      const principal = c.get("principal");
      const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
      const list = await deps.briefing.listRecordings(
        principal.scope.tenantId,
        roomId,
      );
      return c.json({ data: list.map(toRecordingDto) });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:roomId/recordings/start", async (c) => {
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
      const recording = await deps.briefing.startRecording({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        chainId: detail.room.chainId,
        roomId,
        startedByUserId: principal.userId,
        startedAt: new Date().toISOString(),
      });
      if (!recording) {
        return sendError(c, 404, "ROOM_NOT_FOUND", "Briefing room not found");
      }
      await deps.briefing.addMessage({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        roomId,
        speakerKind: "human",
        speakerId: principal.userId,
        speakerName: await resolveDisplayName(deps.users, principal.userId),
        body: "הקלטת הפגישה התחילה — נשמרת בהפרדה לפי tenant / chain / חדר.",
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: toRecordingDto(recording) }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:roomId/recordings/:recordingId/complete", async (c) => {
    try {
      const principal = c.get("principal");
      const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
      const recordingId = roomIdSchema.parse(c.req.param("recordingId"));
      const existing = await deps.briefing.getRecording(
        principal.scope.tenantId,
        roomId,
        recordingId,
      );
      if (!existing) {
        return sendError(c, 404, "NOT_FOUND", "Recording not found");
      }

      const body = await c.req.parseBody();
      const file = body["file"];
      if (!(file instanceof File)) {
        return sendError(c, 400, "FILE_REQUIRED", "Recording file is required");
      }
      const durationRaw = body["durationSeconds"];
      const durationSeconds =
        typeof durationRaw === "string" && durationRaw.length > 0
          ? Number(durationRaw)
          : null;

      const bytes = Buffer.from(await file.arrayBuffer());
      const mimeType = file.type || "video/webm";
      const storageKey = deps.recordings.buildStorageKey({
        tenantId: existing.tenantId,
        chainId: existing.chainId,
        roomId: existing.roomId,
        recordingId: existing.id,
        extension: extensionFromMime(mimeType),
      });
      await deps.recordings.write(storageKey, bytes);

      const detail = await deps.briefing.getDetail(
        principal.scope.tenantId,
        roomId,
      );
      const transcriptJson = JSON.stringify(
        (detail?.messages ?? []).map((message) => ({
          id: message.id,
          speakerKind: message.speakerKind,
          speakerName: message.speakerName,
          body: message.body,
          createdAt: message.createdAt,
        })),
      );

      const completed = await deps.briefing.completeRecording({
        tenantId: principal.scope.tenantId,
        roomId,
        recordingId,
        endedAt: new Date().toISOString(),
        storageKey,
        mimeType,
        byteSize: bytes.byteLength,
        durationSeconds:
          durationSeconds !== null && Number.isFinite(durationSeconds)
            ? Math.max(0, Math.round(durationSeconds))
            : null,
        transcriptJson,
      });
      if (!completed) {
        return sendError(c, 404, "NOT_FOUND", "Recording not found");
      }

      await deps.briefing.addMessage({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        roomId,
        speakerKind: "human",
        speakerId: principal.userId,
        speakerName: await resolveDisplayName(deps.users, principal.userId),
        body: `הקלטת הפגישה נשמרה (${Math.round(bytes.byteLength / 1024)} KB) · מפתח אחסון מופרד.`,
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: toRecordingDto(completed) });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/:roomId/recordings/:recordingId/media", async (c) => {
    try {
      const principal = c.get("principal");
      const roomId = Ids.briefingRoom(roomIdSchema.parse(c.req.param("roomId")));
      const recordingId = roomIdSchema.parse(c.req.param("recordingId"));
      const recording = await deps.briefing.getRecording(
        principal.scope.tenantId,
        roomId,
        recordingId,
      );
      if (!recording || !recording.storageKey) {
        return sendError(c, 404, "NOT_FOUND", "Recording media not found");
      }
      const bytes = await deps.recordings.read(recording.storageKey);
      if (!bytes) {
        return sendError(c, 404, "NOT_FOUND", "Recording file missing");
      }
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": recording.mimeType ?? "video/webm",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": `inline; filename="${recordingId}.webm"`,
          "X-HotelOS-Tenant": recording.tenantId,
          "X-HotelOS-Chain": recording.chainId,
          "X-HotelOS-Room": recording.roomId,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}

async function resolveDisplayName(
  users: UserRepository,
  userId: ReturnType<typeof Ids.user>,
): Promise<string> {
  const user = await users.findById(userId);
  return user?.displayName ?? "משתמש";
}

function toDetailDto(
  detail: NonNullable<
    Awaited<ReturnType<BriefingRepository["getDetail"]>>
  >,
) {
  return {
    room: {
      id: detail.room.id,
      title: detail.room.title,
      purpose: detail.room.purpose,
      status: detail.room.status,
      hostUserId: detail.room.hostUserId,
      chainId: detail.room.chainId,
      createdAt: detail.room.createdAt,
    },
    participants: detail.participants,
    sharedAgents: detail.sharedAgents.map((agent) => ({
      id: agent.id,
      agentId: agent.agentId,
      nameHe: agent.nameHe,
      nameEn: agent.nameEn,
      domain: agent.domain,
      summaryHe: agent.summaryHe,
      autonomyMode: agent.autonomyMode,
      sharedAt: agent.sharedAt,
    })),
    messages: detail.messages,
    recordings: detail.recordings.map(toRecordingDto),
  };
}

function toRecordingDto(
  recording: NonNullable<
    Awaited<ReturnType<BriefingRepository["getRecording"]>>
  >,
) {
  return {
    id: recording.id,
    tenantId: recording.tenantId,
    chainId: recording.chainId,
    roomId: recording.roomId,
    status: recording.status,
    startedByUserId: recording.startedByUserId,
    startedAt: recording.startedAt,
    endedAt: recording.endedAt,
    storageKey: recording.storageKey,
    mimeType: recording.mimeType,
    byteSize: recording.byteSize,
    durationSeconds: recording.durationSeconds,
    hasTranscript: recording.transcriptJson !== null,
    createdAt: recording.createdAt,
  };
}

