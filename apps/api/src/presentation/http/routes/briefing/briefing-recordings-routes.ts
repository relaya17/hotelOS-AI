import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { extensionFromMime } from "../../../../infrastructure/recording-storage.js";
import { mapUnknownError, sendError } from "../../errors.js";
import { roomIdSchema } from "./briefing-schemas.js";
import { resolveDisplayName, toRecordingDto } from "./briefing-dto.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { BriefingRouteDeps } from "./briefing-deps.js";

export function createBriefingRecordingsRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

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

        const hasConsent = await deps.briefing.hasRecordingConsent(
          principal.scope.tenantId,
          roomId,
          principal.userId,
        );
        if (!hasConsent) {
          return sendError(
            c,
            403,
            "RECORDING_CONSENT_REQUIRED",
            "יש לאשר את מדיניות ההקלטה לפני התחלת הקלטה",
          );
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
