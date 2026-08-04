import { Hono } from "hono";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { mapUnknownError } from "../../errors.js";
import type { AuthVariables } from "../../auth-middleware.js";
import type { TrustRouteDeps } from "./trust-deps.js";
import { cookieSchema } from "./trust-schemas.js";

export function createTrustCookiesRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.post("/cookies/consent", async (c) => {
    try {
      const body = cookieSchema.parse(await c.req.json());
      await deps.trust.saveCookieConsent({
        id: randomUUID(),
        tenantId: body.tenantId ? Ids.tenant(body.tenantId) : null,
        subjectKey: body.subjectKey,
        necessary: body.necessary,
        functional: body.functional,
        policyVersion: "2026.1",
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: { ok: true, policyVersion: "2026.1" } }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
