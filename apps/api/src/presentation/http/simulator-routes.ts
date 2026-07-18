import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type { JwtTokenService } from "@hotelos/auth";
import { canAccessHotel } from "@hotelos/auth";
import type {
  ApprovalRepository,
  AuditRepository,
  OverviewRepository,
} from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { runRevenueSimulator } from "../../application/run-revenue-simulator.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type SimulatorRouteDeps = {
  readonly overview: OverviewRepository;
  readonly approvals: ApprovalRepository;
  readonly audit: AuditRepository;
  readonly gateway: AiGateway;
  readonly tokens: JwtTokenService;
};

const revenueRunSchema = z.object({
  hotelId: z.string().uuid(),
  adrChangePercent: z.number().min(-50).max(50),
  baseAdr: z.number().positive().max(50000).default(850),
  nights: z.number().int().min(1).max(30).default(1),
  requestApproval: z.boolean().optional().default(true),
});

/**
 * AI Simulator (Vol. 5A.10) — what-if only; never writes rates to Twin/PMS.
 */
export function createSimulatorRoutes(deps: SimulatorRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.post("/revenue/run", async (c) => {
    try {
      const principal = c.get("principal");
      const body = revenueRunSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "Hotel out of scope");
      }

      const simulation = await runRevenueSimulator(deps.overview, {
        tenantId: principal.scope.tenantId,
        hotelId,
        adrChangePercent: body.adrChangePercent,
        baseAdr: body.baseAdr,
        nights: body.nights,
      });
      if (!simulation) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not in overview");
      }

      const contextPack = [
        "Context pack — Revenue Simulator (read-only)",
        `מלון: ${simulation.hotelName}`,
        `בסיס ADR ${simulation.baseline.adr} · תפוסה ${simulation.baseline.occupancyPct}% · RevPAR ${simulation.baseline.revpar}`,
        `מוצע ADR ${simulation.proposed.adr} · תפוסה ${simulation.proposed.occupancyPct}% · RevPAR ${simulation.proposed.revpar}`,
        `Delta הכנסה משוערת: ${simulation.delta.revenuePct}%`,
        ...simulation.assumptionsHe.map((line) => `הנחה: ${line}`),
        ...simulation.risksHe.map((line) => `סיכון: ${line}`),
        "אל תבצע שינוי מחיר. הסבר בעברית קצרה למנהל הכנסות.",
      ].join("\n");

      const ai = await deps.gateway.invoke({
        agentId: "agent.revenue",
        message: `סכם את תוצאות הסימולציה לשינוי ADR של ${body.adrChangePercent}%.`,
        tenantId: principal.scope.tenantId,
        userId: principal.userId,
        hotelId: body.hotelId,
        locale: "he",
        contextPack,
      });

      let approvalId: string | undefined;
      const now = new Date().toISOString();
      if (body.requestApproval && simulation.requiresHumanApproval) {
        const created = await deps.approvals.create({
          id: randomUUID(),
          tenantId: principal.scope.tenantId,
          hotelId,
          agentId: "agent.revenue",
          requestedByUserId: principal.userId,
          summaryHe: `סימולציית מחיר ${simulation.hotelName}: ADR ${body.adrChangePercent}%`,
          reasonHe:
            simulation.approvalReasonHe ??
            "שינוי ADR מעל סף — נדרש אישור לפני Act",
          payloadJson: JSON.stringify({
            kind: "simulator.revenue",
            simulation,
            executesChange: false,
          }),
          createdAt: now,
        });
        approvalId = created.id;
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "simulator.revenue.run",
        resourceType: "revenue_simulation",
        resourceId: approvalId ?? String(hotelId),
        metadata: {
          hotelId: body.hotelId,
          adrChangePercent: body.adrChangePercent,
          requiresHumanApproval: simulation.requiresHumanApproval,
        },
        createdAt: now,
      });

      return c.json({
        data: {
          simulation,
          narrativeHe: ai.answerHe,
          ...(approvalId !== undefined ? { approvalId } : {}),
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
