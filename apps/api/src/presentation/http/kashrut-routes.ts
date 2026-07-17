import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { HotelRepository, KashrutRepository } from "@hotelos/database";
import { canAccessHotel, type JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type KashrutRouteDeps = {
  readonly kashrut: KashrutRepository;
  readonly hotels: HotelRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdSchema = z.string().uuid();

const createAnnotationSchema = z.object({
  targetKind: z.enum(["procurement", "menu", "briefing", "event", "other"]),
  targetId: z.string().trim().min(1).max(120),
  status: z.enum(["ok", "note", "warn", "block"]),
  message: z.string().trim().max(2000).optional(),
});

export function createKashrutRoutes(deps: KashrutRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/annotations", async (c) => {
    try {
      const principal = c.get("principal");
      const raw = c.req.query("hotelId");
      if (!raw) {
        return sendError(c, 400, "HOTEL_ID_REQUIRED", "hotelId query param is required");
      }
      const parsed = hotelIdSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
      }
      const hotelId = Ids.hotel(parsed.data);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }

      const hotel = (await deps.hotels.listByTenant(principal.scope.tenantId)).find(
        (row) => row.id === hotelId,
      );
      if (!hotel) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const targetKindRaw = c.req.query("targetKind");
      const targetKind = createAnnotationSchema.shape.targetKind
        .optional()
        .parse(targetKindRaw);

      const list = await deps.kashrut.listByHotel(
        principal.scope.tenantId,
        hotelId,
        targetKind,
      );
      return c.json({ data: { kashrutEnabled: hotel.kashrutEnabled, annotations: list } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/annotations", async (c) => {
    try {
      const principal = c.get("principal");
      const raw = c.req.query("hotelId");
      if (!raw) {
        return sendError(c, 400, "HOTEL_ID_REQUIRED", "hotelId query param is required");
      }
      const parsed = hotelIdSchema.safeParse(raw);
      if (!parsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
      }
      const hotelId = Ids.hotel(parsed.data);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }

      const hotel = (await deps.hotels.listByTenant(principal.scope.tenantId)).find(
        (row) => row.id === hotelId,
      );
      if (!hotel) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }
      if (!hotel.kashrutEnabled) {
        return sendError(
          c,
          409,
          "KASHRUT_DISABLED",
          "Kashrut supervision is not enabled for this hotel",
        );
      }

      const body = createAnnotationSchema.parse(await c.req.json());
      const created = await deps.kashrut.create({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        targetKind: body.targetKind,
        targetId: body.targetId,
        status: body.status,
        ...(body.message ? { message: body.message } : {}),
        createdByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
