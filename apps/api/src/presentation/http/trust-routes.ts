import { Hono } from "hono";
import type {
  AuditRepository,
  RefreshSessionRepository,
  TrustRepository,
  UserRepository,
} from "@hotelos/database";
import { hashVoiceSample } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type TrustRouteDeps = {
  readonly trust: TrustRepository;
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly googleRedirectUri: string;
  readonly googlePostLoginRedirect: string;
  readonly webauthnRpId: string;
  readonly webauthnRpName: string;
};

const cookieSchema = z.object({
  subjectKey: z.string().trim().min(8).max(120),
  necessary: z.boolean(),
  functional: z.boolean(),
  tenantId: z.string().uuid().optional(),
});

const paymentSchema = z.object({
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.string().length(3).default("ILS"),
  description: z.string().trim().min(2).max(200),
  hotelId: z.string().uuid().optional(),
  payerEmail: z.string().email().optional(),
});

const signatureSchema = z.object({
  subjectType: z.enum(["attendance", "booking", "payment", "document"]),
  subjectId: z.string().trim().min(2).max(80),
  signerName: z.string().trim().min(2).max(120),
  purpose: z.string().trim().min(2).max(160),
  imageDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,/)
    .max(1_500_000),
});

const webauthnRegisterSchema = z.object({
  credentialId: z.string().min(8).max(512),
  publicKeyJwkJson: z.string().min(2).max(8000),
  deviceLabel: z.string().trim().min(2).max(80).default("Platform authenticator"),
  challenge: z.string().min(16).max(200),
});

const webauthnAssertSchema = z.object({
  tenantId: z.string().uuid(),
  credentialId: z.string().min(8).max(512),
  challenge: z.string().min(16).max(200),
  clientDataJSON: z.string().min(8).max(4000),
});

const webauthnLoginChallengeSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
});

const voiceSchema = z.object({
  phrase: z.string().trim().min(2).max(120).default("HotelOS attendance"),
  sampleBase64: z.string().min(16).max(2_000_000),
});

const attendanceSchema = z.object({
  employeeId: z.string().uuid(),
  hotelId: z.string().uuid(),
  eventType: z.enum(["clock_in", "clock_out"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().positive().max(5000).optional(),
  deviceLabel: z.string().trim().min(2).max(80).default("mobile"),
  signatureId: z.string().uuid().optional(),
  voiceSampleBase64: z.string().min(16).max(2_000_000).optional(),
  webauthnCredentialId: z.string().min(8).max(512).optional(),
  webauthnChallenge: z.string().min(16).max(200).optional(),
  note: z.string().trim().max(240).optional(),
});

const googleDemoSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email().default("admin@demo.hotelos.local"),
});

export function createTrustRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/cookies/consent", async (c) => {
    try {
      const body = cookieSchema.parse(await c.req.json());
      await deps.trust.saveCookieConsent({
        id: randomUUID(),
        tenantId: body.tenantId ? Ids.tenant(body.tenantId) : null,
        subjectKey: body.subjectKey,
        necessary: body.necessary,
        functional: body.functional,
        policyVersion: "2026.1",
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: { ok: true, policyVersion: "2026.1" } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/oauth/google/start", (c) => {
    const tenantId = c.req.query("tenantId");
    if (!tenantId) {
      return sendError(c, 400, "TENANT_REQUIRED", "tenantId query required");
    }
    if (!deps.googleClientId) {
      return c.json({
        data: {
          mode: "demo",
          message:
            "GOOGLE_CLIENT_ID not configured — use POST /v1/trust/oauth/google/demo for staff demo login",
          demoEndpoint: "/v1/trust/oauth/google/demo",
        },
      });
    }
    const state = Buffer.from(
      JSON.stringify({ tenantId, nonce: randomUUID() }),
    ).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", deps.googleClientId);
    url.searchParams.set("redirect_uri", deps.googleRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    return c.json({ data: { mode: "oauth", url: url.toString() } });
  });

  routes.post("/webauthn/login-challenge", async (c) => {
    try {
      const body = webauthnLoginChallengeSchema.parse(await c.req.json());
      const user = await deps.users.findByTenantAndEmail(
        Ids.tenant(body.tenantId),
        body.email.toLowerCase(),
      );
      if (!user) {
        return sendError(c, 404, "USER_NOT_FOUND", "User not found");
      }
      const credentials = await deps.trust.listWebAuthnCredentials(
        user.tenantId,
        user.id,
      );
      if (credentials.length === 0) {
        return sendError(
          c,
          400,
          "NO_CREDENTIALS",
          "Register a biometric credential while logged in first",
        );
      }
      const challenge = await deps.trust.createChallenge({
        id: randomUUID(),
        tenantId: user.tenantId,
        userId: user.id,
        purpose: "webauthn.assert",
        ttlSeconds: 300,
      });
      return c.json({
        data: {
          ...challenge,
          allowCredentials: credentials.map((item) => item.credentialId),
          rpId: deps.webauthnRpId,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/oauth/google/demo", async (c) => {
    try {
      const body = googleDemoSchema.parse(await c.req.json());
      const user = await deps.users.findByTenantAndEmail(
        Ids.tenant(body.tenantId),
        body.email.toLowerCase(),
      );
      if (!user) {
        return sendError(c, 404, "USER_NOT_FOUND", "Demo Google user not found");
      }
      await deps.trust.linkOAuthIdentity({
        id: randomUUID(),
        tenantId: Ids.tenant(user.tenantId),
        userId: Ids.user(user.id),
        provider: "google",
        providerSubject: `demo-google:${user.email}`,
        email: user.email,
        createdAt: new Date().toISOString(),
      });
      return issueSessionForUser(deps, c, user, "auth.google.demo");
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/oauth/google/callback", async (c) => {
    try {
      if (!deps.googleClientId || !deps.googleClientSecret) {
        return sendError(
          c,
          503,
          "GOOGLE_NOT_CONFIGURED",
          "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET required for OAuth callback",
        );
      }
      const code = c.req.query("code");
      const stateRaw = c.req.query("state");
      const oauthError = c.req.query("error");
      if (oauthError) {
        return sendError(c, 400, "GOOGLE_DENIED", oauthError);
      }
      if (!code || !stateRaw) {
        return sendError(c, 400, "OAUTH_INVALID", "code and state required");
      }

      let tenantId: string;
      try {
        const state = JSON.parse(
          Buffer.from(stateRaw, "base64url").toString("utf8"),
        ) as { tenantId?: string };
        if (!state.tenantId) {
          throw new Error("missing tenantId");
        }
        tenantId = state.tenantId;
      } catch {
        return sendError(c, 400, "STATE_INVALID", "Invalid OAuth state");
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: deps.googleClientId,
          client_secret: deps.googleClientSecret,
          redirect_uri: deps.googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokenJson = (await tokenRes.json()) as {
        access_token?: string;
        error?: string;
      };
      if (!tokenRes.ok || !tokenJson.access_token) {
        return sendError(
          c,
          401,
          "GOOGLE_TOKEN_FAILED",
          tokenJson.error ?? "Failed to exchange Google code",
        );
      }

      const profileRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        },
      );
      const profile = (await profileRes.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
      };
      if (!profileRes.ok || !profile.email || !profile.sub) {
        return sendError(c, 401, "GOOGLE_PROFILE_FAILED", "Google profile missing");
      }
      if (profile.email_verified === false) {
        return sendError(c, 403, "EMAIL_UNVERIFIED", "Google email not verified");
      }

      const user = await deps.users.findByTenantAndEmail(
        Ids.tenant(tenantId),
        profile.email.toLowerCase(),
      );
      if (!user) {
        return sendError(
          c,
          404,
          "USER_NOT_FOUND",
          "No HotelOS staff user for this Google email — invite the user first",
        );
      }

      await deps.trust.linkOAuthIdentity({
        id: randomUUID(),
        tenantId: Ids.tenant(user.tenantId),
        userId: Ids.user(user.id),
        provider: "google",
        providerSubject: profile.sub,
        email: user.email,
        createdAt: new Date().toISOString(),
      });

      const session = await buildSessionPayload(deps, user, "auth.google.oauth");
      const fragment = Buffer.from(JSON.stringify(session)).toString("base64url");
      const target = new URL(deps.googlePostLoginRedirect);
      target.hash = `hotelos_oauth=${fragment}`;
      return c.redirect(target.toString(), 302);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.use("/payments/*", requireAuth(deps.tokens));
  routes.use("/signatures/*", requireAuth(deps.tokens));
  routes.use("/voice/*", requireAuth(deps.tokens));
  routes.use("/attendance/*", requireAuth(deps.tokens));
  routes.use("/webauthn/challenge", requireAuth(deps.tokens));
  routes.use("/webauthn/register", requireAuth(deps.tokens));
  routes.use("/webauthn/credentials", requireAuth(deps.tokens));

  routes.post("/payments/intents", async (c) => {
    try {
      const principal = c.get("principal");
      const body = paymentSchema.parse(await c.req.json());
      const intent = await deps.trust.createPaymentIntent({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: body.hotelId ?? principal.scope.hotelId ?? null,
        amountMinor: body.amountMinor,
        currency: body.currency.toUpperCase(),
        description: body.description,
        payerEmail: body.payerEmail ?? null,
        createdAt: new Date().toISOString(),
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "payment.intent.created",
        resourceType: "payment_intent",
        resourceId: intent.id,
        metadata: { amountMinor: intent.amountMinor, currency: intent.currency },
        createdAt: new Date().toISOString(),
        ...(principal.scope.hotelId !== undefined
          ? { hotelId: principal.scope.hotelId }
          : {}),
      });
      return c.json({ data: intent }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/payments/intents/:id/confirm", async (c) => {
    try {
      const principal = c.get("principal");
      const confirmed = await deps.trust.confirmPaymentIntent(
        principal.scope.tenantId,
        c.req.param("id"),
      );
      if (!confirmed) {
        return sendError(c, 404, "NOT_FOUND", "Payment intent not found");
      }
      return c.json({ data: confirmed });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/payments/intents", async (c) => {
    try {
      const principal = c.get("principal");
      return c.json({
        data: await deps.trust.listPayments(principal.scope.tenantId),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/signatures", async (c) => {
    try {
      const principal = c.get("principal");
      const body = signatureSchema.parse(await c.req.json());
      const user = await deps.users.findById(principal.userId);
      const signature = await deps.trust.createSignature({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        signerName: body.signerName || user?.displayName || "Signer",
        signerUserId: principal.userId,
        purpose: body.purpose,
        imageDataUrl: body.imageDataUrl,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: signature }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/webauthn/challenge", async (c) => {
    try {
      const principal = c.get("principal");
      const purpose =
        c.req.query("purpose") === "assert" ? "webauthn.assert" : "webauthn.register";
      const challenge = await deps.trust.createChallenge({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        userId: principal.userId,
        purpose,
        ttlSeconds: 300,
      });
      return c.json({
        data: {
          ...challenge,
          rp: { id: deps.webauthnRpId, name: deps.webauthnRpName },
          user: {
            id: principal.userId,
            name: (await deps.users.findById(principal.userId))?.email ?? "user",
            displayName:
              (await deps.users.findById(principal.userId))?.displayName ??
              "User",
          },
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/webauthn/register", async (c) => {
    try {
      const principal = c.get("principal");
      const body = webauthnRegisterSchema.parse(await c.req.json());
      const consumed = await deps.trust.consumeChallenge(
        principal.scope.tenantId,
        body.challenge,
        "webauthn.register",
      );
      if (!consumed) {
        return sendError(c, 400, "CHALLENGE_INVALID", "Challenge expired or invalid");
      }
      await deps.trust.saveWebAuthnCredential({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        userId: principal.userId,
        credentialId: body.credentialId,
        publicKeyJwkJson: body.publicKeyJwkJson,
        deviceLabel: body.deviceLabel,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: { ok: true } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/webauthn/credentials", async (c) => {
    try {
      const principal = c.get("principal");
      return c.json({
        data: await deps.trust.listWebAuthnCredentials(
          principal.scope.tenantId,
          principal.userId,
        ),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/webauthn/assert", async (c) => {
    try {
      const body = webauthnAssertSchema.parse(await c.req.json());
      const tenantId = Ids.tenant(body.tenantId);
      const consumed = await deps.trust.consumeChallenge(
        tenantId,
        body.challenge,
        "webauthn.assert",
      );
      if (!consumed) {
        return sendError(c, 400, "CHALLENGE_INVALID", "Challenge expired or invalid");
      }
      const clientData = JSON.parse(
        Buffer.from(body.clientDataJSON, "base64url").toString("utf8"),
      ) as { challenge?: string; type?: string };
      if (clientData.challenge !== body.challenge) {
        return sendError(c, 400, "CHALLENGE_MISMATCH", "Client challenge mismatch");
      }
      const credential = await deps.trust.findWebAuthnCredential(body.credentialId);
      if (!credential || credential.tenantId !== body.tenantId) {
        return sendError(c, 404, "CREDENTIAL_NOT_FOUND", "Unknown credential");
      }
      const user = await deps.users.findById(Ids.user(credential.userId));
      if (!user) {
        return sendError(c, 404, "USER_NOT_FOUND", "User not found");
      }
      return issueSessionForUser(deps, c, user, "auth.webauthn");
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

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
      if (body.webauthnCredentialId && body.webauthnChallenge) {
        const consumed = await deps.trust.consumeChallenge(
          principal.scope.tenantId,
          body.webauthnChallenge,
          "webauthn.assert",
        );
        const cred = await deps.trust.findWebAuthnCredential(
          body.webauthnCredentialId,
        );
        webauthnVerified =
          consumed !== null &&
          cred !== null &&
          cred.userId === principal.userId;
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

type SessionUser = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string | null;
  readonly hotelId: string | null;
  readonly departmentId: string | null;
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly string[];
};

type SessionPayload = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly roles: readonly string[];
    readonly scope: {
      readonly tenantId: string;
      readonly chainId?: string;
      readonly hotelId?: string;
      readonly departmentId?: string;
    };
  };
};

async function buildSessionPayload(
  deps: TrustRouteDeps,
  user: SessionUser,
  action: string,
): Promise<SessionPayload> {
  const scope: {
    tenantId: ReturnType<typeof Ids.tenant>;
    chainId?: ReturnType<typeof Ids.chain>;
    hotelId?: ReturnType<typeof Ids.hotel>;
    departmentId?: ReturnType<typeof Ids.department>;
  } = { tenantId: Ids.tenant(user.tenantId) };
  if (user.chainId) scope.chainId = Ids.chain(user.chainId);
  if (user.hotelId) scope.hotelId = Ids.hotel(user.hotelId);
  if (user.departmentId) scope.departmentId = Ids.department(user.departmentId);

  const principal = {
    userId: Ids.user(user.id),
    roles: user.roles,
    scope,
  };
  const pair = await deps.tokens.issuePair(principal);
  await deps.sessions.create({
    id: randomUUID(),
    userId: principal.userId,
    tenantId: principal.scope.tenantId,
    tokenHash: pair.refreshTokenHash,
    expiresAt: pair.refreshExpiresAt,
    createdAt: new Date().toISOString(),
  });
  await deps.audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    actorUserId: principal.userId,
    action,
    resourceType: "user",
    resourceId: principal.userId,
    metadata: { email: user.email },
    createdAt: new Date().toISOString(),
    ...(principal.scope.hotelId !== undefined
      ? { hotelId: principal.scope.hotelId }
      : {}),
  });

  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      scope: {
        tenantId: user.tenantId,
        ...(user.chainId ? { chainId: user.chainId } : {}),
        ...(user.hotelId ? { hotelId: user.hotelId } : {}),
        ...(user.departmentId ? { departmentId: user.departmentId } : {}),
      },
    },
  };
}

async function issueSessionForUser(
  deps: TrustRouteDeps,
  c: { json: (body: unknown, status?: number) => Response },
  user: SessionUser,
  action: string,
): Promise<Response> {
  return c.json(await buildSessionPayload(deps, user, action));
}
