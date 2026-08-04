import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import type { OpsRouteDeps } from "./routes/ops/ops-deps.js";
import { createOpsDepartmentsRoutes } from "./routes/ops/ops-departments-routes.js";
import { createOpsEquipmentRoutes } from "./routes/ops/ops-equipment-routes.js";
import { createOpsExecutiveRoutes } from "./routes/ops/ops-executive-routes.js";
import { createOpsFeedbackReputationRoutes } from "./routes/ops/ops-feedback-reputation-routes.js";
import { createOpsIncidentsRoutes } from "./routes/ops/ops-incidents-routes.js";
import { createOpsMaintenanceRoutes } from "./routes/ops/ops-maintenance-routes.js";
import { createOpsProcurementRoutes } from "./routes/ops/ops-procurement-routes.js";
import { createOpsRecruitingRoutes } from "./routes/ops/ops-recruiting-routes.js";
import { createOpsRevenueRoutes } from "./routes/ops/ops-revenue-routes.js";

export type { OpsRouteDeps } from "./routes/ops/ops-deps.js";

export function createOpsRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.route("/", createOpsDepartmentsRoutes(deps));
  routes.route("/", createOpsMaintenanceRoutes(deps));
  routes.route("/", createOpsProcurementRoutes(deps));
  routes.route("/", createOpsFeedbackReputationRoutes(deps));
  routes.route("/", createOpsRecruitingRoutes(deps));
  routes.route("/", createOpsIncidentsRoutes(deps));
  routes.route("/", createOpsExecutiveRoutes(deps));
  routes.route("/", createOpsRevenueRoutes(deps));
  routes.route("/", createOpsEquipmentRoutes(deps));

  return routes;
}
