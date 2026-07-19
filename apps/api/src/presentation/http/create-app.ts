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
import { createLegalRoutes } from "./legal-routes.js";
import {
  createTrustRoutes,
  type TrustRouteDeps,
} from "./trust-routes.js";
import {
  createOpsRoutes,
  type OpsRouteDeps,
} from "./ops-routes.js";
import {
  createOrgCommsRoutes,
  type OrgCommsRouteDeps,
} from "./org-comms-routes.js";
import {
  createKnowledgeRoutes,
  type KnowledgeRouteDeps,
} from "./knowledge-routes.js";
import {
  createKashrutRoutes,
  type KashrutRouteDeps,
} from "./kashrut-routes.js";
import {
  createAiGatewayRoutes,
  type AiGatewayRouteDeps,
} from "./ai-gateway-routes.js";
import {
  createHrRoutes,
  type HrRouteDeps,
} from "./hr-routes.js";
import {
  createCorrespondenceRoutes,
  type CorrespondenceRouteDeps,
} from "./correspondence-routes.js";
import {
  createApprovalRoutes,
  type ApprovalRouteDeps,
} from "./approval-routes.js";
import {
  createTwinRoutes,
  type TwinRouteDeps,
} from "./twin-routes.js";
import {
  createCronRoutes,
  type CronRouteDeps,
} from "./cron-routes.js";
import {
  createSimulatorRoutes,
  type SimulatorRouteDeps,
} from "./simulator-routes.js";
import {
  createAutonomyRoutes,
  type AutonomyRouteDeps,
} from "./autonomy-routes.js";
import { isOriginAllowed } from "@hotelos/config";
import { captureException } from "../../infrastructure/observability.js";
import { createRateLimitMiddleware } from "./rate-limit.js";
import { securityHeaders } from "./security-headers.js";

export type ApiDependencies = {
  readonly getHealth: GetHealth;
  readonly logger: Logger;
  readonly corsOrigins: readonly string[];
  readonly isProduction: boolean;
  readonly auth: AuthRouteDeps;
  readonly hotels: HotelRouteDeps;
  readonly overview: OverviewRouteDeps;
  readonly publicRoutes: PublicRouteDeps;
  readonly agents: AgentRouteDeps;
  readonly briefing: BriefingRouteDeps;
  readonly turbo: TurboRouteDeps;
  readonly trust: TrustRouteDeps;
  readonly ops: OpsRouteDeps;
  readonly orgComms: OrgCommsRouteDeps;
  readonly knowledge: KnowledgeRouteDeps;
  readonly kashrut: KashrutRouteDeps;
  readonly aiGateway: AiGatewayRouteDeps;
  readonly hr: HrRouteDeps;
  readonly correspondence: CorrespondenceRouteDeps;
  readonly approvals: ApprovalRouteDeps;
  readonly autonomy: AutonomyRouteDeps;
  readonly twin: TwinRouteDeps;
  readonly cron: CronRouteDeps;
  readonly simulator: SimulatorRouteDeps;
};

export function createApp(deps: ApiDependencies): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    captureException(error);
    deps.logger.error("unhandled request error", {
      path: c.req.path,
      message: error instanceof Error ? error.message : String(error),
    });
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unexpected server error",
          details: {},
          correlationId: c.res.headers.get("x-correlation-id") ?? "unknown",
        },
      },
      500,
    );
  });

  app.use("*", securityHeaders(deps.isProduction));

  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Non-browser clients (no Origin) — allow.
        if (!origin) return deps.corsOrigins[0] ?? "*";
        return isOriginAllowed(origin, deps.corsOrigins) ? origin : "";
      },
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Correlation-Id",
        "X-Tenant-Id",
        "X-HotelOS-Tenant",
      ],
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

  app.use(
    "*",
    createRateLimitMiddleware({
      tokens: deps.auth.tokens,
    }),
  );

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
      trust: [
        "terms",
        "cookies",
        "security",
        "payments",
        "digital_signature",
        "webauthn",
        "voice",
        "google_oauth",
        "attendance",
      ],
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
  app.route("/v1/public/legal", createLegalRoutes());
  app.route("/v1/agents", createAgentRoutes(deps.agents));
  app.route("/v1/briefing-rooms", createBriefingRoutes(deps.briefing));
  app.route("/v1/turbo", createTurboRoutes(deps.turbo));
  app.route("/v1/trust", createTrustRoutes(deps.trust));
  app.route("/v1/ops", createOpsRoutes(deps.ops));
  app.route("/v1/org-comms", createOrgCommsRoutes(deps.orgComms));
  app.route("/v1/knowledge", createKnowledgeRoutes(deps.knowledge));
  app.route("/v1/kashrut", createKashrutRoutes(deps.kashrut));
  app.route("/v1/ai/gateway", createAiGatewayRoutes(deps.aiGateway));
  app.route("/v1/ai/approvals", createApprovalRoutes(deps.approvals));
  app.route("/v1/autonomy", createAutonomyRoutes(deps.autonomy));
  app.route("/v1/hr", createHrRoutes(deps.hr));
  app.route("/v1/correspondence", createCorrespondenceRoutes(deps.correspondence));
  app.route("/v1/twin", createTwinRoutes(deps.twin));
  app.route("/v1/cron", createCronRoutes(deps.cron));
  app.route("/v1/simulator", createSimulatorRoutes(deps.simulator));

  return app;
}
