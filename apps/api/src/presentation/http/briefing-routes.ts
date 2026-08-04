import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import type { BriefingRouteDeps } from "./routes/briefing/briefing-deps.js";
import { createBriefingCollabRoutes } from "./routes/briefing/briefing-collab-routes.js";
import { createBriefingGoalsRoutes } from "./routes/briefing/briefing-goals-routes.js";
import { createBriefingRecordingsRoutes } from "./routes/briefing/briefing-recordings-routes.js";
import { createBriefingRoomsRoutes } from "./routes/briefing/briefing-rooms-routes.js";

export type { BriefingRouteDeps } from "./routes/briefing/briefing-deps.js";

export function createBriefingRoutes(deps: BriefingRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.route("/", createBriefingRoomsRoutes(deps));
  routes.route("/", createBriefingGoalsRoutes(deps));
  routes.route("/", createBriefingCollabRoutes(deps));
  routes.route("/", createBriefingRecordingsRoutes(deps));

  return routes;
}
