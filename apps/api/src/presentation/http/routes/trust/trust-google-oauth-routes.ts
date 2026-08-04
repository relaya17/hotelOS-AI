import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError, sendError } from "../../errors.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { TrustRouteDeps } from "./trust-deps.js";
import { googleDemoSchema } from "./trust-schemas.js";
import { buildSessionPayload, issueSessionForUser } from "./trust-session.js";

export function createTrustGoogleOauthRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.get("/oauth/google/start", (c) => {
    const tenantId = c.req.query("tenantId");
    if (!tenantId) {
      return sendError(c, 400, "TENANT_REQUIRED", "tenantId query required");
    }
    if (!deps.googleClientId) {
      if (!deps.allowDemoAuth) {
        return sendError(
          c,
          503,
          "GOOGLE_NOT_CONFIGURED",
          "GOOGLE_CLIENT_ID required; demo Google login is disabled",
        );
      }
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

  routes.post("/oauth/google/demo", async (c) => {
    try {
      if (!deps.allowDemoAuth) {
        return sendError(
          c,
          403,
          "DEMO_AUTH_DISABLED",
          "Demo Google login is disabled in this environment",
        );
      }
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

  return routes;
}
