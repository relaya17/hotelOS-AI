import { Hono } from "hono";
import type { OverviewRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type OverviewRouteDeps = {
  readonly overview: OverviewRepository;
  readonly tokens: JwtTokenService;
};

export function createOverviewRoutes(deps: OverviewRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/chain", async (c) => {
    try {
      const principal = c.get("principal");
      const overview = await deps.overview.getChainOverview(
        principal.scope.tenantId,
      );
      if (!overview) {
        return sendError(c, 404, "TENANT_NOT_FOUND", "Tenant not found");
      }
      return c.json({ data: overview });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
