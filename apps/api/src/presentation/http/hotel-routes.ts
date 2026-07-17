import { Hono } from "hono";
import type { HotelRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError } from "./errors.js";

export type HotelRouteDeps = {
  readonly hotels: HotelRepository;
  readonly tokens: JwtTokenService;
};

export function createHotelRoutes(deps: HotelRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.use("*", requireAuth(deps.tokens));

  routes.get("/", async (c) => {
    try {
      const principal = c.get("principal");
      const hotels = await deps.hotels.listByTenant(principal.scope.tenantId);
      return c.json({
        data: hotels.map((hotel) => ({
          id: hotel.id,
          name: hotel.name,
          timezone: hotel.timezone,
          currency: hotel.currency,
          chainId: hotel.chainId,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
