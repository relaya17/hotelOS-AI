import { Hono } from "hono";
import type { PublicRouteDeps } from "./routes/public/public-deps.js";
import { createPublicChannelsRoutes } from "./routes/public/public-channels-routes.js";
import { createPublicHotelsRoutes } from "./routes/public/public-hotels-routes.js";
import { createPublicHrInviteRoutes } from "./routes/public/public-hr-invite-routes.js";
import { createPublicIngestRoutes } from "./routes/public/public-ingest-routes.js";
import { createPublicStaysRoutes } from "./routes/public/public-stays-routes.js";

export type { PublicRouteDeps } from "./routes/public/public-deps.js";

export function createPublicRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.route("/", createPublicIngestRoutes(deps));
  routes.route("/", createPublicChannelsRoutes(deps));
  routes.route("/", createPublicHotelsRoutes(deps));
  routes.route("/", createPublicStaysRoutes(deps));
  routes.route("/", createPublicHrInviteRoutes(deps));

  return routes;
}
