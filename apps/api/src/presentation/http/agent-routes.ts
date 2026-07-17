import { Hono } from "hono";
import type { AgentRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError } from "./errors.js";

export type AgentRouteDeps = {
  readonly agents: AgentRepository;
  readonly tokens: JwtTokenService;
};

export function createAgentRoutes(deps: AgentRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/", async (c) => {
    try {
      const list = await deps.agents.listAll();
      return c.json({
        data: list.map((agent) => ({
          id: agent.id,
          nameHe: agent.nameHe,
          nameEn: agent.nameEn,
          domain: agent.domain,
          summaryHe: agent.summaryHe,
          autonomyMode: agent.autonomyMode,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
