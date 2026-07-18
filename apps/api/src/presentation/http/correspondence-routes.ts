import { Hono } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type { JwtTokenService } from "@hotelos/auth";
import type {
  AuditRepository,
  CompanyKnowledgeRepository,
  CorrespondenceRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { randomUUID } from "node:crypto";
import { buildKnowledgeContextPack } from "../../application/build-knowledge-context-pack.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type CorrespondenceRouteDeps = {
  readonly correspondence: CorrespondenceRepository;
  readonly companyKnowledge: CompanyKnowledgeRepository;
  readonly gateway: AiGateway;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

const draftSchema = z.object({
  kind: z.enum(["formal_letter", "purchase_note", "speech"]),
  subject: z.string().trim().min(2).max(200),
  recipientLabel: z.string().trim().min(2).max(200),
  hotelId: z.string().uuid().optional(),
  contextNotes: z.string().trim().max(4000).optional(),
});

export function createCorrespondenceRoutes(deps: CorrespondenceRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/drafts", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = c.req.query("hotelId");
      const data = await deps.correspondence.listDrafts(
        principal.scope.tenantId,
        hotelId ? Ids.hotel(hotelId) : undefined,
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/drafts", async (c) => {
    try {
      const principal = c.get("principal");
      const body = draftSchema.parse(await c.req.json());
      const kindLabel =
        body.kind === "formal_letter"
          ? "מכתב רשמי"
          : body.kind === "purchase_note"
            ? "הזמנת רכש בכתב"
            : "נאום / דברי פתיחה";

      const knowledgePack = await buildKnowledgeContextPack(
        deps.companyKnowledge,
        principal.scope.tenantId,
        [body.subject, body.contextNotes ?? ""].join(" "),
      );
      const basePack =
        "תבנית מכתב רשמי HotelOS · טיוטה לבדיקה בלבד · אין שליחה אוטומטית";
      const contextPack =
        knowledgePack !== undefined
          ? `${basePack}\n\n${knowledgePack}`.slice(0, 12000)
          : basePack;

      const ai = await deps.gateway.invoke({
        agentId: "agent.correspondence",
        message: [
          `נסח טיוטת ${kindLabel}.`,
          `נושא: ${body.subject}`,
          `נמען: ${body.recipientLabel}`,
          body.contextNotes ? `הקשר מהמשתמש: ${body.contextNotes}` : "",
          "כל עובדה חסרה סמן כ-[יש להשלים ידנית]. אל תשלח — רק טיוטה.",
        ]
          .filter(Boolean)
          .join("\n"),
        tenantId: String(principal.scope.tenantId),
        userId: String(principal.userId),
        locale: "he",
        ...(body.hotelId !== undefined ? { hotelId: body.hotelId } : {}),
        contextPack,
      });

      const now = new Date().toISOString();
      const draft = await deps.correspondence.createDraft({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        kind: body.kind,
        subject: body.subject,
        recipientLabel: body.recipientLabel,
        body: ai.answerHe,
        createdByUserId: principal.userId,
        createdAt: now,
        ...(body.hotelId !== undefined
          ? { hotelId: Ids.hotel(body.hotelId) }
          : {}),
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "correspondence.draft.create",
        resourceType: "letter_draft",
        resourceId: draft.id,
        metadata: {
          kind: draft.kind,
          requiresHumanApproval: ai.requiresHumanApproval,
        },
        createdAt: now,
      });

      return c.json(
        {
          data: {
            ...draft,
            requiresHumanApproval: ai.requiresHumanApproval,
            approvalReasonHe: ai.approvalReasonHe,
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/drafts/:id/status", async (c) => {
    try {
      const principal = c.get("principal");
      const statusSchema = z.object({
        status: z.enum(["draft", "approved", "discarded"]),
      });
      const body = statusSchema.parse(await c.req.json());
      const now = new Date().toISOString();
      const updated = await deps.correspondence.updateStatus(
        principal.scope.tenantId,
        c.req.param("id"),
        body.status,
        now,
      );
      if (!updated) {
        return sendError(c, 404, "DRAFT_NOT_FOUND", "Draft not found");
      }
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: `correspondence.draft.${body.status}`,
        resourceType: "letter_draft",
        resourceId: updated.id,
        metadata: { status: body.status },
        createdAt: now,
      });
      return c.json({ data: updated });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
