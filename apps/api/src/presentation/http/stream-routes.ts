import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import {
  canAccessHotel,
  type JwtTokenService,
} from "@hotelos/auth";
import type {
  BookingRepository,
  EnergyRepository,
  EquipmentRepository,
  FeedbackRepository,
  HotelRepository,
  MaintenanceRepository,
  OpsRepository,
  OverviewRepository,
  ProcurementRepository,
} from "@hotelos/database";
import type { HotelId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import {
  buildOpsLiveSnapshot,
  hashOpsLiveSnapshot,
} from "../../application/build-ops-live-snapshot.js";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

type StreamContext = Context<{ Variables: AuthVariables }>;
type HotelIdResult =
  | { readonly ok: true; readonly hotelId: HotelId }
  | { readonly ok: false; readonly response: Response };

/** Align with default JWT access TTL (900s) — reconnect before token expiry. */
export const OPS_DASHBOARD_STREAM_MAX_MS = 12 * 60 * 1000;
export const OPS_DASHBOARD_SNAPSHOT_INTERVAL_MS = 15_000;

export type StreamRouteDeps = {
  readonly tokens: JwtTokenService;
  readonly hotels: HotelRepository;
  readonly ops: OpsRepository;
  readonly maintenance: MaintenanceRepository;
  readonly equipment: EquipmentRepository;
  readonly energy: EnergyRepository;
  readonly overview: OverviewRepository;
  readonly bookings: BookingRepository;
  readonly procurement: ProcurementRepository;
  readonly feedback: FeedbackRepository;
};

const hotelIdSchema = z.string().uuid();

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export function createResolveStreamHotelId(deps: Pick<StreamRouteDeps, "hotels">) {
  return async function resolveHotelId(c: StreamContext): Promise<HotelIdResult> {
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

export function createStreamRoutes(deps: StreamRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));
  const resolveHotelId = createResolveStreamHotelId(deps);

  routes.get("/ops-dashboard", async (c) => {
    try {
      const resolved = await resolveHotelId(c);
      if (!resolved.ok) {
        return resolved.response;
      }

      const principal = c.get("principal");
      const tenantId = principal.scope.tenantId;
      const hotelId = resolved.hotelId;
      const snapshotDeps = {
        ops: deps.ops,
        maintenance: deps.maintenance,
        hotels: deps.hotels,
        equipment: deps.equipment,
        energy: deps.energy,
        overview: deps.overview,
        bookings: deps.bookings,
        procurement: deps.procurement,
        feedback: deps.feedback,
      };

      return streamSSE(c, async (stream) => {
        const startedAt = Date.now();
        let lastHash: string | null = null;

        const pushUpdate = async (): Promise<void> => {
          const snapshot = await buildOpsLiveSnapshot(snapshotDeps, tenantId, hotelId);
          const hash = hashOpsLiveSnapshot(snapshot);
          if (hash !== lastHash) {
            lastHash = hash;
            await stream.writeSSE({
              event: "snapshot",
              data: JSON.stringify(snapshot),
            });
            return;
          }
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ at: new Date().toISOString() }),
          });
        };

        await pushUpdate();

        while (
          !c.req.raw.signal.aborted &&
          Date.now() - startedAt < OPS_DASHBOARD_STREAM_MAX_MS
        ) {
          await sleep(OPS_DASHBOARD_SNAPSHOT_INTERVAL_MS, c.req.raw.signal);
          if (c.req.raw.signal.aborted) {
            break;
          }
          if (Date.now() - startedAt >= OPS_DASHBOARD_STREAM_MAX_MS) {
            break;
          }
          await pushUpdate();
        }

        if (!c.req.raw.signal.aborted) {
          await stream.writeSSE({
            event: "reconnect",
            data: JSON.stringify({
              reason: "token_ttl",
              reconnectAfterMs: 1_000,
            }),
          });
        }
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
