import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import type { AutonomyRouteDeps } from "./routes/autonomy/autonomy-deps.js";
import { createAutonomyFinanceRoutes } from "./routes/autonomy/autonomy-finance-routes.js";
import { createAutonomyOpsShortcutsRoutes } from "./routes/autonomy/autonomy-ops-shortcuts-routes.js";
import { createAutonomyProcurementRoutes } from "./routes/autonomy/autonomy-procurement-routes.js";
import { createAutonomyRecruitingRoutes } from "./routes/autonomy/autonomy-recruiting-routes.js";
import { createAutonomySuggestRoutes } from "./routes/autonomy/autonomy-suggest-routes.js";

export type { AutonomyRouteDeps } from "./routes/autonomy/autonomy-deps.js";

/**
 * Autonomy Suggest — creates a pending AI approval (HITL) before Act.
 */
export function createAutonomyRoutes(deps: AutonomyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.route("/", createAutonomySuggestRoutes(deps));
  routes.route("/", createAutonomyProcurementRoutes(deps));
  routes.route("/", createAutonomyOpsShortcutsRoutes(deps));
  routes.route("/", createAutonomyRecruitingRoutes(deps));
  routes.route("/", createAutonomyFinanceRoutes(deps));

  return routes;
}
