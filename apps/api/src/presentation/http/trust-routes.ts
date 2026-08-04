import { Hono } from "hono";
import type { AuthVariables } from "./auth-middleware.js";
import type { TrustRouteDeps } from "./routes/trust/trust-deps.js";
import { createTrustAttendanceVoiceRoutes } from "./routes/trust/trust-attendance-voice-routes.js";
import { createTrustCookiesRoutes } from "./routes/trust/trust-cookies-routes.js";
import { createTrustGoogleOauthRoutes } from "./routes/trust/trust-google-oauth-routes.js";
import { createTrustPaymentsSignaturesRoutes } from "./routes/trust/trust-payments-signatures-routes.js";
import { createTrustWebauthnRoutes } from "./routes/trust/trust-webauthn-routes.js";

export type { TrustRouteDeps } from "./routes/trust/trust-deps.js";

export function createTrustRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.route("/", createTrustCookiesRoutes(deps));
  routes.route("/", createTrustGoogleOauthRoutes(deps));
  routes.route("/", createTrustWebauthnRoutes(deps));
  routes.route("/", createTrustPaymentsSignaturesRoutes(deps));
  routes.route("/", createTrustAttendanceVoiceRoutes(deps));

  return routes;
}
