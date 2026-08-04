import { Hono } from "hono";
import { z } from "@hotelos/validation";
import { handleWhatsAppInbound } from "../../../../application/handle-whatsapp-inbound.js";
import { runPublicBookAssistant } from "../../../../application/run-public-book-assistant.js";
import { mapUnknownError } from "../../errors.js";
import type { PublicRouteDeps } from "./public-deps.js";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bookAssistantSchema = z.object({
  message: z.string().trim().max(2000).default(""),
  confirm: z.boolean().optional(),
  draft: z
    .object({
      hotelId: z.string().uuid().optional(),
      checkInDate: dateSchema.optional(),
      checkOutDate: dateSchema.optional(),
      roomType: z.string().trim().min(2).max(40).optional(),
      guestName: z.string().trim().min(2).max(120).optional(),
      guestEmail: z.string().email().max(200).optional(),
      guestPhone: z.string().trim().min(6).max(40).optional(),
    })
    .optional(),
});

const whatsappInboundSchema = z.object({
  from: z.string().trim().min(5).max(40),
  body: z.string().trim().max(2000),
  hotelId: z.string().uuid().optional(),
});

export function createPublicChannelsRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/whatsapp/inbound", async (c) => {
    try {
      const body = whatsappInboundSchema.parse(await c.req.json());
      const data = await handleWhatsAppInbound(
        {
          hotels: deps.hotels,
          rooms: deps.rooms,
          bookings: deps.bookings,
          audit: deps.audit,
          trust: deps.trust,
          payments: deps.payments,
          guestStays: deps.guestStays,
          ops: deps.ops,
          turbo: deps.turbo,
          ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
          ...(deps.pms ? { pms: deps.pms } : {}),
        },
        {
          from: body.from,
          body: body.body,
          ...(body.hotelId !== undefined ? { hotelId: body.hotelId } : {}),
        },
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/book-assistant", async (c) => {
    try {
      const body = bookAssistantSchema.parse(await c.req.json());
      const draft = body.draft
        ? {
            ...(body.draft.hotelId !== undefined
              ? { hotelId: body.draft.hotelId }
              : {}),
            ...(body.draft.checkInDate !== undefined
              ? { checkInDate: body.draft.checkInDate }
              : {}),
            ...(body.draft.checkOutDate !== undefined
              ? { checkOutDate: body.draft.checkOutDate }
              : {}),
            ...(body.draft.roomType !== undefined
              ? { roomType: body.draft.roomType }
              : {}),
            ...(body.draft.guestName !== undefined
              ? { guestName: body.draft.guestName }
              : {}),
            ...(body.draft.guestEmail !== undefined
              ? { guestEmail: body.draft.guestEmail }
              : {}),
            ...(body.draft.guestPhone !== undefined
              ? { guestPhone: body.draft.guestPhone }
              : {}),
          }
        : undefined;
      const data = await runPublicBookAssistant(
        {
          hotels: deps.hotels,
          rooms: deps.rooms,
          bookings: deps.bookings,
          audit: deps.audit,
          trust: deps.trust,
          payments: deps.payments,
          turbo: deps.turbo,
          ops: deps.ops,
          ...(deps.guestProfiles ? { guestProfiles: deps.guestProfiles } : {}),
          ...(deps.pms ? { pms: deps.pms } : {}),
        },
        {
          message: body.message,
          ...(body.confirm !== undefined ? { confirm: body.confirm } : {}),
          ...(draft !== undefined ? { draft } : {}),
        },
      );
      return c.json({ data });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
