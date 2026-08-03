import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  INTEGRATION_DOMAINS,
  isConfigurableIntegrationDomainId,
} from "@hotelos/connectors";
import type { AuditRepository, HotelRepository } from "@hotelos/database";
import { canAccessHotel, type JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type IntegrationRouteDeps = {
  readonly pmsProvider: string;
  /** True when MEWS tokens are present (no secret values exposed). */
  readonly mewsConfigured: boolean;
  readonly tokens: JwtTokenService;
  readonly hotels: HotelRepository;
  readonly audit: AuditRepository;
};

const hotelIdSchema = z.string().uuid();

const enabledDomainsSchema = z.object({
  enabled: z.array(z.string()),
});

function validateEnabledDomainIds(enabled: readonly string[]): string | null {
  for (const id of enabled) {
    if (!isConfigurableIntegrationDomainId(id)) {
      return id;
    }
  }
  return null;
}

/**
 * Integration catalog + per-hotel domain enablement (preference only — no secrets).
 * Auth: requireAuth. Hotel-scoped reads/writes enforce canAccessHotel.
 */
export function createIntegrationRoutes(deps: IntegrationRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/catalog", async (c) => {
    try {
      const principal = c.get("principal");
      const rawHotelId = c.req.query("hotelId");
      const base = {
        domains: INTEGRATION_DOMAINS,
        live: {
          pmsProvider: deps.pmsProvider,
          mewsConfigured: deps.mewsConfigured,
          pmsLiveReady:
            deps.pmsProvider === "mews" ? deps.mewsConfigured : true,
        },
      };

      if (!rawHotelId) {
        return c.json({ data: base });
      }

      const parsed = hotelIdSchema.safeParse(rawHotelId);
      if (!parsed.success) {
        return sendError(c, 400, "VALIDATION_ERROR", "Invalid hotelId");
      }
      const hotelId = Ids.hotel(parsed.data);
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }

      const enabled = await deps.hotels.getEnabledIntegrationDomains(
        principal.scope.tenantId,
        hotelId,
      );
      if (!enabled) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      return c.json({
        data: {
          ...base,
          enabledForHotel: enabled,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.put("/hotels/:hotelId/domains", async (c) => {
    try {
      const principal = c.get("principal");
      const hotelId = Ids.hotel(hotelIdSchema.parse(c.req.param("hotelId")));
      if (!canAccessHotel(principal, hotelId)) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }

      const body = enabledDomainsSchema.parse(await c.req.json());
      const invalidId = validateEnabledDomainIds(body.enabled);
      if (invalidId !== null) {
        return sendError(
          c,
          400,
          "INVALID_INTEGRATION_DOMAIN",
          `Unknown or deferred integration domain: ${invalidId}`,
        );
      }

      const enabled = body.enabled.filter(isConfigurableIntegrationDomainId);
      const updated = await deps.hotels.setEnabledIntegrationDomains(
        principal.scope.tenantId,
        hotelId,
        enabled,
      );
      if (!updated) {
        return sendError(c, 404, "HOTEL_NOT_FOUND", "Hotel not found");
      }

      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        hotelId,
        actorUserId: principal.userId,
        action: "integration_domains.updated",
        resourceType: "hotel",
        resourceId: hotelId,
        metadata: {
          enabledCount: body.enabled.length,
        },
        createdAt: new Date().toISOString(),
      });

      return c.json({
        data: {
          hotelId: updated.id,
          enabled: updated.enabledIntegrationDomains,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
