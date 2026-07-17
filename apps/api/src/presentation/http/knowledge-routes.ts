import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { TrustedSourcesRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError } from "./errors.js";

export type KnowledgeRouteDeps = {
  readonly trustedSources: TrustedSourcesRepository;
  readonly tokens: JwtTokenService;
};

const createTrustedSourceSchema = z.object({
  title: z.string().trim().min(2).max(200),
  url: z.string().url().max(500),
  category: z.enum([
    "regulator",
    "university",
    "market_data",
    "accounting_standard",
    "kashrut_authority",
    "other",
  ]),
});

/**
 * ADR 0007 §2 — allowlisted external knowledge for `agent.cio` /
 * `agent.kashrut`. Only entries approved here may back a "Trusted" citation;
 * open web search stays discovery-only outside this list.
 */
export function createKnowledgeRoutes(deps: KnowledgeRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/trusted-sources", async (c) => {
    try {
      const principal = c.get("principal");
      const list = await deps.trustedSources.list(principal.scope.tenantId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/trusted-sources", async (c) => {
    try {
      const principal = c.get("principal");
      const body = createTrustedSourceSchema.parse(await c.req.json());
      const created = await deps.trustedSources.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        title: body.title,
        url: body.url,
        category: body.category,
        approvedByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
