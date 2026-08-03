import { Hono, type Context } from "hono";
import type {
  BookingRepository,
  FeedbackRepository,
  GuestProfileRepository,
  HotelRepository,
  ReputationRepository,
} from "@hotelos/database";
import { canAccessHotel, type JwtTokenService } from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { buildGuest360 } from "../../application/build-guest-360.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

type GuestContext = Context<{ Variables: AuthVariables }>;
type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

export type GuestRouteDeps = {
  readonly guestProfiles: GuestProfileRepository;
  readonly bookings: BookingRepository;
  readonly feedback: FeedbackRepository;
  readonly reputation: ReputationRepository;
  readonly hotels: HotelRepository;
  readonly tokens: JwtTokenService;
};

const hotelIdSchema = z.string().uuid();
const emailSchema = z.string().email().max(200);

export function createGuestRoutes(deps: GuestRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  async function resolveHotelId(c: GuestContext): Promise<HotelIdResult> {
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

  routes.get("/by-email", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelResult = await resolveHotelId(c);
      if (!hotelResult.ok) {
        return hotelResult.response;
      }

      const emailRaw = c.req.query("email");
      if (!emailRaw?.trim()) {
        return sendError(c, 400, "EMAIL_REQUIRED", "email query param is required");
      }
      const emailParsed = emailSchema.safeParse(emailRaw.trim());
      if (!emailParsed.success) {
        return sendError(c, 400, "INVALID_EMAIL", "Invalid email address");
      }

      const guest360 = await buildGuest360(
        {
          guestProfiles: deps.guestProfiles,
          bookings: deps.bookings,
          feedback: deps.feedback,
          reputation: deps.reputation,
          hotels: deps.hotels,
        },
        {
          tenantId: principal.scope.tenantId,
          hotelId: hotelResult.hotelId,
          email: emailParsed.data,
        },
      );

      if (!guest360) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      return c.json({ data: guest360 });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
