import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import type { AiGateway } from "@hotelos/ai-gateway";
import type { AuditRepository, UpsellRepository } from "@hotelos/database";
import { canAccessHotel, type JwtTokenService } from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import {
  decideUpsellOffer,
  suggestGuestUpsells,
} from "../../application/suggest-guest-upsells.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

type UpsellContext = Context<{ Variables: AuthVariables }>;
type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

export type UpsellRouteDeps = {
  readonly upsells: UpsellRepository;
  readonly gateway: AiGateway;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdSchema = z.string().uuid();
const bookingIdSchema = z.string().uuid();

const suggestSchema = z.object({
  hotelId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

const decideSchema = z.object({
  decision: z.enum(["accepted", "declined"]),
});

export function createUpsellRoutes(deps: UpsellRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  async function resolveHotelId(c: UpsellContext): Promise<HotelIdResult> {
    const principal = c.get("principal");
    const raw = c.req.query("hotelId");
    if (!raw) {
      return {
        ok: false,
        response: sendError(c, 400, "HOTEL_ID_REQUIRED", "hotelId query param is required"),
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

  routes.post("/suggest", async (c) => {
    try {
      const principal = c.get("principal");
      const body = suggestSchema.parse(await c.req.json());
      const hotelId = Ids.hotel(body.hotelId);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "Hotel access denied");
      }

      const result = await suggestGuestUpsells(deps.upsells, deps.gateway, {
        tenantId: principal.scope.tenantId,
        hotelId,
        bookingId: Ids.booking(body.bookingId),
        actorUserId: String(principal.userId),
      });

      if (!result.ok) {
        const status =
          result.error.code === "BOOKING_NOT_FOUND"
            ? 404
            : result.error.code === "STAY_NOT_ACTIVE"
              ? 409
              : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        actorUserId: principal.userId,
        action: "upsell.suggest",
        resourceType: "upsell_offer",
        resourceId: body.bookingId,
        metadata: {
          count: result.offers.length,
          offerTypes: result.offers.map((offer) => offer.offerType).join(","),
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result.offers }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const bookingRaw = c.req.query("bookingId");
      if (!bookingRaw) {
        return sendError(
          c,
          400,
          "BOOKING_ID_REQUIRED",
          "bookingId query param is required",
        );
      }
      const bookingParsed = bookingIdSchema.safeParse(bookingRaw);
      if (!bookingParsed.success) {
        return sendError(c, 400, "INVALID_BOOKING_ID", "Invalid bookingId");
      }

      const list = await deps.upsells.listByBooking(
        principal.scope.tenantId,
        resolved.hotelId,
        Ids.booking(bookingParsed.data),
      );
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/:id/decide", async (c) => {
    try {
      const principal = c.get("principal");
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) return resolved.response;

      const offerId = z.string().uuid().parse(c.req.param("id"));
      const body = decideSchema.parse(await c.req.json());
      const result = await decideUpsellOffer(deps.upsells, {
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        offerId,
        decision: body.decision,
      });

      if (!result.ok) {
        const status =
          result.error.code === "OFFER_NOT_FOUND"
            ? 404
            : result.error.code === "OFFER_ALREADY_DECIDED"
              ? 409
              : 400;
        return sendError(c, status, result.error.code, result.error.message);
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId: resolved.hotelId,
        actorUserId: principal.userId,
        action: "upsell.decide",
        resourceType: "upsell_offer",
        resourceId: offerId,
        metadata: {
          decision: body.decision,
          offerType: result.offer.offerType,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({ data: result.offer });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
