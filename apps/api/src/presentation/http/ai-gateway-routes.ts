import { Hono } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  CompanyKnowledgeRepository,
  OverviewRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import { z } from "@hotelos/validation";
import { buildKnowledgeContextPack } from "../../application/build-knowledge-context-pack.js";
import { buildOpsContextPack } from "../../application/build-ops-context-pack.js";
import { buildTrustedSourcesContextPack } from "../../application/build-trusted-sources-context-pack.js";
import { mergeContextPacks } from "../../application/merge-context-packs.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

const OPS_AUTO_PACK_AGENTS = new Set([
  "agent.revenue",
  "agent.housekeeping",
  "agent.maintenance",
]);

const KNOWLEDGE_AUTO_PACK_AGENTS = new Set([
  "agent.legal",
  "agent.hr",
  "agent.correspondence",
  "agent.cio",
  "agent.kashrut",
  "agent.cfo",
]);

export type AiGatewayRouteDeps = {
  readonly gateway: AiGateway;
  readonly overview: OverviewRepository;
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly trustedSources: TrustedSourcesRepository;
  readonly tokens: JwtTokenService;
};

const invokeSchema = z.object({
  agentId: z.string().trim().min(3).max(80),
  message: z.string().trim().min(1).max(4000),
  hotelId: z.string().uuid().optional(),
  locale: z.enum(["he", "en"]).optional(),
  contextPack: z.string().trim().max(12000).optional(),
});

export function createAiGatewayRoutes(deps: AiGatewayRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/status", (c) =>
    c.json({
      data: {
        primaryProvider: deps.gateway.primaryProvider,
        entrypoint: "/v1/ai/gateway/invoke",
      },
    }),
  );

  routes.post("/invoke", async (c) => {
    const principal = c.get("principal");
    const parsed = invokeSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return sendError(c, 400, "invalid_body", "בקשת Gateway לא תקינה");
    }

    try {
      let contextPack = parsed.data.contextPack;
      if (
        contextPack === undefined &&
        OPS_AUTO_PACK_AGENTS.has(parsed.data.agentId)
      ) {
        contextPack = await buildOpsContextPack(
          deps.overview,
          principal.scope.tenantId,
          parsed.data.agentId,
        );
      }
      if (KNOWLEDGE_AUTO_PACK_AGENTS.has(parsed.data.agentId)) {
        const [knowledgePack, trustedPack] = await Promise.all([
          buildKnowledgeContextPack(
            deps.companyKnowledge,
            principal.scope.tenantId,
            parsed.data.message,
          ),
          buildTrustedSourcesContextPack(
            deps.trustedSources,
            principal.scope.tenantId,
            parsed.data.message,
          ),
        ]);
        contextPack = mergeContextPacks(
          contextPack,
          knowledgePack,
          trustedPack,
        );
      }
      const result = await deps.gateway.invoke({
        agentId: parsed.data.agentId,
        message: parsed.data.message,
        tenantId: principal.scope.tenantId,
        userId: principal.userId,
        ...(parsed.data.hotelId !== undefined
          ? { hotelId: parsed.data.hotelId }
          : {}),
        ...(parsed.data.locale !== undefined
          ? { locale: parsed.data.locale }
          : {}),
        ...(contextPack !== undefined ? { contextPack } : {}),
      });
      return c.json({ data: result });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unknown agentId")) {
        return sendError(c, 404, "unknown_agent", error.message);
      }
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
