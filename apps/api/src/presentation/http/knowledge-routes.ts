import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type {
  CompanyKnowledgeRepository,
  TrustedSourcesRepository,
} from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { z } from "@hotelos/validation";
import { embedCompanyKnowledgeDoc } from "../../application/embed-company-knowledge-doc.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type KnowledgeRouteDeps = {
  readonly trustedSources: TrustedSourcesRepository;
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly gateway: AiGateway;
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

  const companyDocSchema = z.object({
    title: z.string().trim().min(2).max(200),
    body: z.string().trim().min(2).max(12000),
    category: z.enum([
      "brand",
      "sop",
      "policy",
      "letter_template",
      "other",
    ]),
  });

  routes.get("/company-docs", async (c) => {
    try {
      const principal = c.get("principal");
      const status = c.req.query("status");
      const list = await deps.companyKnowledge.list(
        principal.scope.tenantId,
        status,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/company-docs/search", async (c) => {
    try {
      const principal = c.get("principal");
      const q = c.req.query("q")?.trim() ?? "";
      if (q.length < 2) {
        return sendError(
          c,
          400,
          "QUERY_TOO_SHORT",
          "q must be at least 2 characters",
        );
      }
      const list = await deps.companyKnowledge.search(
        principal.scope.tenantId,
        q,
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/company-docs", async (c) => {
    try {
      const principal = c.get("principal");
      const body = companyDocSchema.parse(await c.req.json());
      const created = await deps.companyKnowledge.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        title: body.title,
        body: body.body,
        category: body.category,
        createdByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/company-docs/:id/approve", async (c) => {
    try {
      const principal = c.get("principal");
      const updated = await deps.companyKnowledge.approve(
        principal.scope.tenantId,
        c.req.param("id"),
        principal.userId,
        new Date().toISOString(),
      );
      if (!updated) {
        return sendError(c, 404, "DOC_NOT_FOUND", "Document not found");
      }
      // Best-effort embed — approve must succeed even if embeddings are down.
      await embedCompanyKnowledgeDoc(
        {
          companyKnowledge: deps.companyKnowledge,
          gateway: deps.gateway,
        },
        { tenantId: principal.scope.tenantId, doc: updated },
      );
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
