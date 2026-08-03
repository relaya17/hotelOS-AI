import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import type {
  AuditRepository,
  BookingRepository,
  EnergyRepository,
  OverviewRepository,
  RoomRepository,
} from "@hotelos/database";
import { canAccessHotel, canDecideOpsHitl, type JwtTokenService } from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import {
  decideEnergySuggestion,
  suggestEnergyActions,
} from "../../application/suggest-energy-actions.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

type EnergyContext = Context<{ Variables: AuthVariables }>;
type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

export type EnergyRouteDeps = {
  readonly energy: EnergyRepository;
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly rooms: RoomRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdSchema = z.string().uuid();

const decideSchema = z.object({
  decision: z.enum(["accepted", "dismissed"]),
});

export function createEnergyRoutes(deps: EnergyRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  async function resolveHotelId(c: EnergyContext): Promise<HotelIdResult> {
    const principal = c.get("principal");
    const raw = c.req.query("hotelId");
    if (!raw) {
      return {
        ok: false,
        response: sendError(
          c,
          400,
          "HOTEL_ID_REQUIRED",
          "hotelId query param is required",
        ),
      };
    }
    const parsed = hotelIdSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        response: sendError(c, 400, "INVALID_HOTEL_ID", "Invalid hotelId"),
      };
    }
    const hotelId = Ids.hotel(parsed.data);
    if (!canAccessHotel(principal, hotelId)) {
      return {
        ok: false,
        response: sendError(c, 403, "FORBIDDEN", "Hotel access denied"),
      };
    }
    return { ok: true, hotelId };
  }

  routes.post("/suggestions/generate", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const result = await suggestEnergyActions(
        {
          overview: deps.overview,
          bookings: deps.bookings,
          rooms: deps.rooms,
          energy: deps.energy,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelId: resolved.hotelId,
        },
      );

      if (!result) {
        return sendError(c, 404, "NO_DATA", "Hotel or overview not found");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "energy.suggestions.generate",
        resourceType: "energy_suggestions",
        resourceId: resolved.hotelId,
        metadata: {
          count: result.suggestions.length,
          periodDate: result.periodDate,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/suggestions", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const statusRaw = c.req.query("status");
      const statusParsed =
        statusRaw === "suggested" ||
        statusRaw === "accepted" ||
        statusRaw === "dismissed"
          ? statusRaw
          : undefined;

      const suggestions = await deps.energy.listSuggestionsByHotel(
        principal.scope.tenantId,
        resolved.hotelId,
        statusParsed,
      );
      return c.json({ data: suggestions });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/suggestions/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canDecideOpsHitl(principal)) {
        return sendError(
          c,
          403,
          "FORBIDDEN",
          "Energy decisions require executive ops approval role",
        );
      }

      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const suggestionId = z.string().uuid().parse(c.req.param("id"));
      const body = decideSchema.parse(await c.req.json());

      const result = await decideEnergySuggestion(deps.energy, {
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        suggestionId,
        decision: body.decision,
      });

      if (!result.ok) {
        const status =
          result.error.code === "SUGGESTION_NOT_FOUND"
            ? 404
            : result.error.code === "ALREADY_DECIDED"
              ? 409
              : result.error.code === "FORBIDDEN"
                ? 403
                : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: `energy.suggestions.${body.decision}`,
        resourceType: "energy_suggestion",
        resourceId: suggestionId,
        metadata: {
          estimatedSavingPct: result.suggestion.estimatedSavingPct,
          periodDate: result.suggestion.periodDate,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result.suggestion });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
