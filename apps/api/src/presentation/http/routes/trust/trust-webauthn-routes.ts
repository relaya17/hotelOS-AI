import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  isUsableWebAuthnPublicKey,
  verifyWebAuthnAssertion,
} from "../../../../domain/webauthn-verify.js";
import { requireAuth, type AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { TrustRouteDeps } from "./trust-deps.js";
import {
  webauthnAssertSchema,
  webauthnLoginChallengeSchema,
  webauthnRegisterSchema,
} from "./trust-schemas.js";
import { issueSessionForUser } from "./trust-session.js";

export function createTrustWebauthnRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

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

  routes.use("/webauthn/challenge", requireAuth(deps.tokens));
  routes.use("/webauthn/register", requireAuth(deps.tokens));
  routes.use("/webauthn/credentials", requireAuth(deps.tokens));

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
      if (!isUsableWebAuthnPublicKey(body.publicKeyJwkJson)) {
        return sendError(
          c,
          400,
          "WEBAUTHN_KEY_INVALID",
          "Public key must be a complete ES256 (P-256) JWK",
        );
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
      const credential = await deps.trust.findWebAuthnCredential(body.credentialId);
      if (!credential || credential.tenantId !== body.tenantId) {
        return sendError(c, 404, "CREDENTIAL_NOT_FOUND", "Unknown credential");
      }
      const verified = verifyWebAuthnAssertion({
        publicKeyJwkJson: credential.publicKeyJwkJson,
        clientDataJSON: body.clientDataJSON,
        authenticatorData: body.authenticatorData,
        signature: body.signature,
        expectedChallenge: body.challenge,
        expectedRpId: deps.webauthnRpId,
        allowedOrigins: deps.webauthnOrigins,
      });
      if (!verified.ok) {
        return sendError(c, 401, "WEBAUTHN_INVALID", verified.reason);
      }
      const consumed = await deps.trust.consumeChallenge(
        tenantId,
        body.challenge,
        "webauthn.assert",
      );
      if (!consumed) {
        return sendError(c, 400, "CHALLENGE_INVALID", "Challenge expired or invalid");
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

  return routes;
}
