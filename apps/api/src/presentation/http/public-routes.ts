import { Hono } from "hono";
import type { GuestStayRepository } from "@hotelos/database";
import { z } from "@hotelos/validation";
import { mapUnknownError } from "./errors.js";

export type PublicRouteDeps = {
  readonly guestStays: GuestStayRepository;
};

const lookupSchema = z.object({
  email: z.string().email().max(200),
});

export function createPublicRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/stays/lookup", async (c) => {
    try {
      const body = lookupSchema.parse(await c.req.json());
      const stays = await deps.guestStays.lookupByEmail(body.email);
      return c.json({
        data: stays.map((stay) => ({
          bookingId: stay.bookingId,
          hotelId: stay.hotelId,
          hotelName: stay.hotelName,
          roomNumber: stay.roomNumber,
          guestName: stay.guestName,
          checkInDate: stay.checkInDate,
          checkOutDate: stay.checkOutDate,
          status: stay.status,
        })),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
