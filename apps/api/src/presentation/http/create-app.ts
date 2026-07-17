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

export type ApiDependencies = {
  readonly getHealth: GetHealth;
  readonly logger: Logger;
  readonly corsOrigin: string;
  readonly auth: AuthRouteDeps;
  readonly hotels: HotelRouteDeps;
};

export function createApp(deps: ApiDependencies): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: deps.corsOrigin,
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

  return app;
}
