import { Hono } from "hono";
import { hashVoiceSample } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { verifyWebAuthnAssertion } from "../../../../domain/webauthn-verify.js";
import { requireAuth, type AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError } from "../../errors.js";
import type { TrustRouteDeps } from "./trust-deps.js";
import { attendanceSchema, voiceSchema } from "./trust-schemas.js";

export function createTrustAttendanceVoiceRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.use("/voice/*", requireAuth(deps.tokens));
  routes.use("/attendance/*", requireAuth(deps.tokens));

  routes.post("/voice/enroll", async (c) => {
    try {
      const principal = c.get("principal");
      const body = voiceSchema.parse(await c.req.json());
      await deps.trust.enrollVoice({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        userId: principal.userId,
        phrase: body.phrase,
        sampleHash: hashVoiceSample(body.sampleBase64),
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: { ok: true, phrase: body.phrase } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/voice/verify", async (c) => {
    try {
      const principal = c.get("principal");
      const body = voiceSchema.parse(await c.req.json());
      const ok = await deps.trust.verifyVoice(
        principal.scope.tenantId,
        principal.userId,
        hashVoiceSample(body.sampleBase64),
      );
      return c.json({ data: { verified: ok } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/attendance", async (c) => {
    try {
      const principal = c.get("principal");
      return c.json({
        data: await deps.trust.listAttendance(principal.scope.tenantId),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/attendance/clock", async (c) => {
    try {
      const principal = c.get("principal");
      const body = attendanceSchema.parse(await c.req.json());
      let voiceVerified = false;
      if (body.voiceSampleBase64) {
        voiceVerified = await deps.trust.verifyVoice(
          principal.scope.tenantId,
          principal.userId,
          hashVoiceSample(body.voiceSampleBase64),
        );
      }
      let webauthnVerified = false;
      if (
        body.webauthnCredentialId &&
        body.webauthnChallenge &&
        body.webauthnClientDataJSON &&
        body.webauthnAuthenticatorData &&
        body.webauthnSignature
      ) {
        const cred = await deps.trust.findWebAuthnCredential(
          body.webauthnCredentialId,
        );
        if (
          cred &&
          cred.userId === principal.userId &&
          cred.tenantId === principal.scope.tenantId
        ) {
          const verified = verifyWebAuthnAssertion({
            publicKeyJwkJson: cred.publicKeyJwkJson,
            clientDataJSON: body.webauthnClientDataJSON,
            authenticatorData: body.webauthnAuthenticatorData,
            signature: body.webauthnSignature,
            expectedChallenge: body.webauthnChallenge,
            expectedRpId: deps.webauthnRpId,
            allowedOrigins: deps.webauthnOrigins,
          });
          if (verified.ok) {
            const consumed = await deps.trust.consumeChallenge(
              principal.scope.tenantId,
              body.webauthnChallenge,
              "webauthn.assert",
            );
            webauthnVerified = consumed !== null;
          }
        }
      }

      const event = await deps.trust.recordAttendance({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: body.hotelId,
        employeeId: body.employeeId,
        userId: principal.userId,
        eventType: body.eventType,
        occurredAt: new Date().toISOString(),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        accuracyMeters: body.accuracyMeters ?? null,
        deviceLabel: body.deviceLabel,
        signatureId: body.signatureId ?? null,
        voiceVerified,
        webauthnVerified,
        note: body.note ?? null,
        createdAt: new Date().toISOString(),
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: `attendance.${body.eventType}`,
        resourceType: "attendance_event",
        resourceId: event.id,
        metadata: {
          employeeId: body.employeeId,
          voiceVerified,
          webauthnVerified,
          hasGeo: body.latitude !== undefined,
        },
        createdAt: new Date().toISOString(),
        hotelId: Ids.hotel(body.hotelId),
      });

      return c.json({ data: { ...event, voiceVerified, webauthnVerified } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
