import { type Context } from "hono";
import { canAccessHotel } from "@hotelos/auth";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import type { AuthVariables } from "../../auth-middleware.js";
import { sendError } from "../../errors.js";
import type { OpsRouteDeps } from "./ops-deps.js";

export type OpsContext = Context<{ Variables: AuthVariables }>;
export type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

export const hotelIdSchema = z.string().uuid();

export function createResolveOpsHotelId(deps: Pick<OpsRouteDeps, "hotels">) {
  return async function resolveHotelId(c: OpsContext): Promise<HotelIdResult> {
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
        response: sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId"),
      };
    }
    const hotelId = Ids.hotel(parsed.data);
    if (!canAccessHotel(principal, hotelId)) {
      return {
        ok: false,
        response: sendError(c, 403, "FORBIDDEN", "No access to this hotel"),
      };
    }
    const tenantHotels = await deps.hotels.listByTenant(principal.scope.tenantId);
    if (!tenantHotels.some((hotel) => hotel.id === hotelId)) {
      return {
        ok: false,
        response: sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found"),
      };
    }
    return { ok: true, hotelId };
  };
}
