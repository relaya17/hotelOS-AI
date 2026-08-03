import { Hono } from "hono";
import { INTEGRATION_DOMAINS } from "@hotelos/connectors";
import type { JwtTokenService } from "@hotelos/auth";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";

export type IntegrationRouteDeps = {
  readonly pmsProvider: string;
  readonly tokens: JwtTokenService;
};

/**
 * Read-only integration catalog — domains from INTEGRATION_DOMAINS plus live
 * connector hints from server env (no secret writes / fake install).
 */
export function createIntegrationRoutes(deps: IntegrationRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/catalog", (c) =>
    c.json({
      data: {
        domains: INTEGRATION_DOMAINS,
        live: {
          pmsProvider: deps.pmsProvider,
        },
      },
    }),
  );

  return routes;
}
