import { Hono } from "hono";
import type { HotelRepository, RoomRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type HotelRouteDeps = {
  readonly hotels: HotelRepository;
  readonly rooms: RoomRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdParamSchema = z.string().uuid();

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

  routes.get("/:hotelId/rooms", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelIdRaw = hotelIdParamSchema.parse(c.req.param("hotelId"));
      const hotelId = Ids.hotel(hotelIdRaw);
      const belongs = await deps.rooms.hotelBelongsToTenant(
        principal.scope.tenantId,
        hotelId,
      );
      if (!belongs) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      const rooms = await deps.rooms.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      return c.json({
        data: rooms.map((room) => ({
          id: room.id,
          number: room.number,
          floor: room.floor,
          roomType: room.roomType,
          status: room.status,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
