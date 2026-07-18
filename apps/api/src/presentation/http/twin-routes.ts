import { Hono } from "hono";
import {
  createPmsConnector,
  mergeHotelTwin,
  type PmsConnector,
} from "@hotelos/connectors";
import type { JwtTokenService } from "@hotelos/auth";
import { canAccessHotel } from "@hotelos/auth";
import type { RoomRepository } from "@hotelos/database";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type TwinRouteDeps = {
  readonly rooms: RoomRepository;
  readonly tokens: JwtTokenService;
  readonly pms?: PmsConnector;
};

export function createTwinRoutes(deps: TwinRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));
  const pms = deps.pms ?? createPmsConnector("demo");

  routes.get("/hotels/:hotelId", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = Ids.hotel(z.string().uuid().parse(c.req.param("hotelId")));
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "Hotel out of scope");
      }
      const includePms = c.req.query("pms") !== "0";
      const hotelosRooms = await deps.rooms.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      const inventory = includePms
        ? await pms.fetchInventory(String(hotelId))
        : undefined;
      const twin = mergeHotelTwin({
        hotelId: String(hotelId),
        hotelosRooms: hotelosRooms.map((room) => ({
          roomNumber: room.number,
          status: room.status,
        })),
        ...(inventory !== undefined ? { pms: inventory } : {}),
      });
      return c.json({ data: twin });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/hotels/:hotelId/pms-sync", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = Ids.hotel(z.string().uuid().parse(c.req.param("hotelId")));
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "Hotel out of scope");
      }
      const inventory = await pms.fetchInventory(String(hotelId));
      const hotelosRooms = await deps.rooms.listByHotel(
        principal.scope.tenantId,
        hotelId,
      );
      const twin = mergeHotelTwin({
        hotelId: String(hotelId),
        hotelosRooms: hotelosRooms.map((room) => ({
          roomNumber: room.number,
          status: room.status,
        })),
        pms: inventory,
      });
      return c.json({
        data: {
          twin,
          sync: {
            providerId: inventory.providerId,
            mode: "read_merge_only",
            noteHe:
              "סנכרון דמו בלבד — לא כותב חזרה ל־PMS ולא משנה סטטוסי חדר ב־HotelOS ללא אישור.",
          },
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
