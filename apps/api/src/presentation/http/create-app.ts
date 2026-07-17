import { Hono } from "hono";
import { cors } from "hono/cors";
import type { GetHealth } from "../../application/get-health.js";
import type { Logger } from "@hotelos/logger";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import {
  createAuthRoutes,
  type AuthRouteDeps,
} from "./auth-routes.js";
import {
  createHotelRoutes,
  type HotelRouteDeps,
} from "./hotel-routes.js";
import {
  createOverviewRoutes,
  type OverviewRouteDeps,
} from "./overview-routes.js";
import {
  createPublicRoutes,
  type PublicRouteDeps,
} from "./public-routes.js";
import {
  createAgentRoutes,
  type AgentRouteDeps,
} from "./agent-routes.js";
import {
  createBriefingRoutes,
  type BriefingRouteDeps,
} from "./briefing-routes.js";
import {
  createTurboRoutes,
  type TurboRouteDeps,
} from "./turbo-routes.js";

export type ApiDependencies = {
  readonly getHealth: GetHealth;
  readonly logger: Logger;
  readonly corsOrigins: readonly string[];
  readonly auth: AuthRouteDeps;
  readonly hotels: HotelRouteDeps;
  readonly overview: OverviewRouteDeps;
  readonly publicRoutes: PublicRouteDeps;
  readonly agents: AgentRouteDeps;
  readonly briefing: BriefingRouteDeps;
  readonly turbo: TurboRouteDeps;
};

export function createApp(deps: ApiDependencies): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: [...deps.corsOrigins],
      allowHeaders: ["Content-Type", "Authorization", "X-Correlation-Id"],
      exposeHeaders: ["X-Correlation-Id"],
    }),
  );

  app.use("*", async (c, next) => {
    const correlationHeader = c.req.header("x-correlation-id");
    const correlationId = Ids.correlation(correlationHeader ?? randomUUID());
    c.header("x-correlation-id", correlationId);
    deps.logger.child({ correlationId }).debug("request", {
      method: c.req.method,
      path: c.req.path,
    });
    await next();
  });

  app.get("/health", (c) => c.json(deps.getHealth()));

  app.get("/v1/meta/apps", (c) =>
    c.json({
      apps: [
        {
          id: "executive",
          name: "Executive — לוח בקרה לרשת",
          url: "http://localhost:5173",
          level: "chain",
        },
        {
          id: "admin",
          name: "Admin — תפעול מלון",
          url: "http://localhost:5174",
          level: "hotel",
        },
        {
          id: "guest",
          name: "Guest — אפליקציית אורחים",
          url: "http://localhost:5175",
          level: "guest",
        },
      ],
      positioning: "AI Intelligence Layer for Hotels",
    }),
  );

  app.get("/v1/meta/tenancy-model", (c) =>
    c.json({
      hierarchy: [
        "platform",
        "tenant",
        "hotel_chain",
        "hotel",
        "department",
        "user",
      ],
      positioning: "AI Intelligence Layer for Hotels",
    }),
  );

  app.route("/v1/auth", createAuthRoutes(deps.auth));
  app.route("/v1/hotels", createHotelRoutes(deps.hotels));
  app.route("/v1/overview", createOverviewRoutes(deps.overview));
  app.route("/v1/public", createPublicRoutes(deps.publicRoutes));
  app.route("/v1/agents", createAgentRoutes(deps.agents));
  app.route("/v1/briefing-rooms", createBriefingRoutes(deps.briefing));
  app.route("/v1/turbo", createTurboRoutes(deps.turbo));

  return app;
}
