import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  canAccessHotel,
  canApproveMoneyAmount,
  canDecideOpsHitl,
  canOperateProcurement,
} from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import type { AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { OpsRouteDeps } from "./ops-deps.js";
import { createResolveOpsHotelId, hotelIdSchema, type OpsContext } from "./ops-hotel.js";

import { buildCioDigest } from "../../../../application/build-cio-digest.js";
import {
  buildCfoFinanceBrief,
  FINANCE_DOCTOR_AUDIENCES,
  FINANCE_DOCTOR_FOCUSES,
} from "../../../../application/build-cfo-finance-brief.js";
import { buildDailyBriefing } from "../../../../application/build-daily-briefing.js";
import { buildOpsKnowledgeGraph } from "../../../../application/build-ops-knowledge-graph.js";
import { ingestTrustedMarketFeeds } from "../../../../application/ingest-trusted-market-feeds.js";
import { synthesizeCfoFinanceBrief } from "../../../../application/synthesize-cfo-finance-brief.js";
import { synthesizeCioDigest } from "../../../../application/synthesize-cio-digest.js";
import { cioDigestRoleSchema } from "./ops-schemas.js";


export function createOpsExecutiveRoutes(deps: OpsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const resolveHotelId = createResolveOpsHotelId(deps);

  // ---- Daily briefing (in-system digest for managers/executives) ----

  routes.get("/daily-briefing", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const briefing = await buildDailyBriefing(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
        },
        principal.scope.tenantId,
        scopedHotelIds,
      );
      if (!briefing) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }
      return c.json({ data: briefing });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- CIO digest ("יועץ־על") — role-based, deterministic (ADR 0007) ----

  routes.get("/cio-digest", async (c) => {
    try {
      const principal = c.get("principal");
      const roleParsed = cioDigestRoleSchema.safeParse(c.req.query("role") ?? "ceo");
      if (!roleParsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid role");
      }

      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const digest = await buildCioDigest(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
          kashrut: deps.kashrut,
          hotels: deps.hotels,
          turbo: deps.turbo,
          bookings: deps.bookings,
        },
        principal.scope.tenantId,
        scopedHotelIds,
        roleParsed.data,
      );
      if (!digest) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }
      return c.json({ data: digest });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Smart digest: deterministic facts + Gateway narrative for the selected role. */
  routes.post("/cio-digest/synthesize", async (c) => {
    try {
      const principal = c.get("principal");
      const body = z
        .object({ role: cioDigestRoleSchema.default("ceo") })
        .parse(await c.req.json().catch(() => ({})));

      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const synthesized = await synthesizeCioDigest(
        {
          overview: deps.overview,
          ops: deps.ops,
          maintenance: deps.maintenance,
          procurement: deps.procurement,
          feedback: deps.feedback,
          kashrut: deps.kashrut,
          hotels: deps.hotels,
          turbo: deps.turbo,
          bookings: deps.bookings,
          gateway: deps.gateway,
          companyKnowledge: deps.companyKnowledge,
          trustedSources: deps.trustedSources,
          trustedSourceSnapshots: deps.snapshots,
        },
        {
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
          hotelIds: scopedHotelIds,
          role: body.role,
        },
      );
      if (!synthesized) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "cio.digest.synthesize",
        resourceType: "cio_digest",
        resourceId: body.role,
        metadata: {
          provider: synthesized.provider,
          requiresHumanApproval: synthesized.requiresHumanApproval,
          suggestedActions: synthesized.suggestedActionsHe.length,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: synthesized });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Finance Doctor — deterministic brief (ledger + Trusted market). */
  routes.get("/cfo-finance-brief", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const brief = await buildCfoFinanceBrief(
        {
          overview: deps.overview,
          hotels: deps.hotels,
          turbo: deps.turbo,
          procurement: deps.procurement,
          trustedSources: deps.trustedSources,
          snapshots: deps.snapshots,
          maintenance: deps.maintenance,
          ...(deps.guestProfiles
            ? { guestProfiles: deps.guestProfiles }
            : {}),
        },
        principal.scope.tenantId,
        scopedHotelIds,
      );
      if (!brief) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }
      return c.json({ data: brief });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Finance Doctor — executive advisor (owner/CEO/CFO) over brief + Trusted + Company Knowledge. */
  routes.post("/cfo-finance-brief/synthesize", async (c) => {
    try {
      const principal = c.get("principal");
      const body = z
        .object({
          questionHe: z.string().trim().min(2).max(4000).optional(),
          audience: z.enum(FINANCE_DOCTOR_AUDIENCES).default("cfo"),
          focus: z.enum(FINANCE_DOCTOR_FOCUSES).default("all"),
        })
        .parse(await c.req.json().catch(() => ({})));

      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scopedHotelIds = (
        principal.scope.hotelId
          ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
          : tenantHotels
      ).map((hotel) => hotel.id);

      const synthesized = await synthesizeCfoFinanceBrief(
        {
          overview: deps.overview,
          hotels: deps.hotels,
          turbo: deps.turbo,
          procurement: deps.procurement,
          trustedSources: deps.trustedSources,
          snapshots: deps.snapshots,
          maintenance: deps.maintenance,
          gateway: deps.gateway,
          companyKnowledge: deps.companyKnowledge,
          ...(deps.guestProfiles
            ? { guestProfiles: deps.guestProfiles }
            : {}),
        },
        {
          tenantId: principal.scope.tenantId,
          userId: principal.userId,
          hotelIds: scopedHotelIds,
          audience: body.audience,
          focus: body.focus,
          ...(body.questionHe ? { questionHe: body.questionHe } : {}),
        },
      );
      if (!synthesized) {
        return sendError(c, 404, "NO_DATA", "No overview data available yet");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "cfo.finance_brief.synthesize",
        resourceType: "cfo_finance_brief",
        resourceId: synthesized.agentId,
        metadata: {
          provider: synthesized.provider,
          audience: synthesized.audience,
          focus: synthesized.focus,
          requiresHumanApproval: synthesized.requiresHumanApproval,
          suggestedActions: synthesized.suggestedActionsHe.length,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: synthesized });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  /** Refresh allowlisted Trusted market/regulator feeds into snapshots. */
  routes.post("/cfo-finance-brief/refresh-feeds", async (c) => {
    try {
      const principal = c.get("principal");
      const result = await ingestTrustedMarketFeeds(
        {
          trustedSources: deps.trustedSources,
          snapshots: deps.snapshots,
          gateway: deps.gateway,
        },
        principal.scope.tenantId,
      );

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "cfo.market_feeds.refresh",
        resourceType: "trusted_source_snapshots",
        resourceId: principal.scope.tenantId,
        metadata: {
          attempted: result.attempted,
          ok: result.ok,
          failed: result.failed,
          embedded: result.embedded,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/cfo-finance-brief/snapshots", async (c) => {
    try {
      const principal = c.get("principal");
      const rows = await deps.snapshots.listLatestByTenant(
        principal.scope.tenantId,
        { limit: 30 },
      );
      return c.json({
        data: rows.map((row) => ({
          id: row.id,
          sourceId: row.sourceId,
          fetchedAt: row.fetchedAt,
          title: row.title,
          summary: row.summary,
          status: row.status,
          error: row.error,
          hasEmbedding: row.embedding !== null && row.embedding.length > 0,
          embeddedAt: row.embeddedAt,
          embeddingModel: row.embeddingModel,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Operational knowledge graph (Vol 5 §5.5 — explicit nodes/edges) ----

  routes.get("/knowledge-graph", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) {
        return resolved.response;
      }
      if (!deps.guestProfiles) {
        return sendError(
          c,
          503,
          "GUEST_PROFILES_UNAVAILABLE",
          "Guest profiles repository is not configured",
        );
      }
      const graph = await buildOpsKnowledgeGraph(
        {
          hotels: deps.hotels,
          rooms: deps.rooms,
          bookings: deps.bookings,
          guestProfiles: deps.guestProfiles,
          ops: deps.ops,
          equipment: deps.equipment,
          maintenance: deps.maintenance,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelId: resolved.hotelId,
        },
      );
      if (!graph) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      return c.json({ data: graph });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  // ---- Unified dashboard ----

  routes.get("/dashboard", async (c) => {
    try {
      const principal = c.get("principal");
      const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      const scoped = principal.scope.hotelId
        ? tenantHotels.filter((hotel) => hotel.id === principal.scope.hotelId)
        : tenantHotels;

      const perHotel = await Promise.all(
        scoped.map(async (hotel) => {
          const [depts, requests, inventory, orders, avgRating] = await Promise.all([
            deps.ops.listDepartments(principal.scope.tenantId, hotel.id),
            deps.maintenance.listByHotel(principal.scope.tenantId, hotel.id),
            deps.procurement.listInventory(principal.scope.tenantId, hotel.id),
            deps.procurement.listPurchaseOrders(principal.scope.tenantId, hotel.id),
            deps.feedback.averageRating(principal.scope.tenantId, hotel.id),
          ]);

          const openRequests = requests.filter(
            (request) => request.status !== "done" && request.status !== "cancelled",
          );
          const pendingQuoteRequests = requests.filter(
            (request) => request.status === "quote_requested",
          );
          const lowStock = inventory.filter((item) => item.belowThreshold);
          const openOrders = orders.filter(
            (order) => order.status !== "received" && order.status !== "cancelled",
          );

          return {
            hotelId: hotel.id,
            hotelName: hotel.name,
            departmentCount: depts.length,
            openMaintenanceRequests: openRequests.length,
            pendingQuoteRequests: pendingQuoteRequests.length,
            lowStockItems: lowStock.length,
            openPurchaseOrders: openOrders.length,
            averageFeedbackRating: avgRating,
          };
        }),
      );

      return c.json({ data: { hotels: perHotel } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
