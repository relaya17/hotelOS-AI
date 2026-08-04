import { Hono } from "hono";
import { canAccessHotel, canOperateProcurement } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import { requireAuth, type AuthVariables } from "../../auth-middleware.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { TrustRouteDeps } from "./trust-deps.js";
import { paymentSchema, signatureSchema } from "./trust-schemas.js";

export function createTrustPaymentsSignaturesRoutes(deps: TrustRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();

  routes.use("/payments/*", requireAuth(deps.tokens));
  routes.use("/signatures/*", requireAuth(deps.tokens));

  routes.post("/payments/intents", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Creating payment intents requires a procurement/management role",
        );
      }
      const body = paymentSchema.parse(await c.req.json());
      if (body.hotelId && !canAccessHotel(principal, Ids.hotel(body.hotelId))) {
        return sendError(c, 403, "FORBIDDEN", "No access to this hotel");
      }
      const paymentId = randomUUID();
      const providerIntent = await deps.payments.createIntent({
        id: paymentId,
        amountMinor: body.amountMinor,
        currency: body.currency.toUpperCase(),
        description: body.description,
        ...(body.payerEmail !== undefined
          ? { payerEmail: body.payerEmail }
          : {}),
      });
      const intent = await deps.trust.createPaymentIntent({
        id: paymentId,
        tenantId: principal.scope.tenantId,
        hotelId: body.hotelId ?? principal.scope.hotelId ?? null,
        amountMinor: body.amountMinor,
        currency: body.currency.toUpperCase(),
        description: body.description,
        payerEmail: body.payerEmail ?? null,
        createdAt: new Date().toISOString(),
        provider: providerIntent.provider,
        status: providerIntent.status,
        confirmedAt:
          providerIntent.status === "succeeded"
            ? new Date().toISOString()
            : null,
      });
      await deps.audit.append({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        actorUserId: principal.userId,
        action: "payment.intent.created",
        resourceType: "payment_intent",
        resourceId: intent.id,
        metadata: {
          amountMinor: intent.amountMinor,
          currency: intent.currency,
          provider: intent.provider,
        },
        createdAt: new Date().toISOString(),
        ...(principal.scope.hotelId !== undefined
          ? { hotelId: principal.scope.hotelId }
          : {}),
      });
      return c.json(
        {
          data: {
            ...intent,
            ...(providerIntent.clientSecret
              ? { clientSecret: providerIntent.clientSecret }
              : {}),
            ...(providerIntent.providerRef
              ? { providerRef: providerIntent.providerRef }
              : {}),
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/payments/intents/:id/confirm", async (c) => {
    try {
      const principal = c.get("principal");
      if (!canOperateProcurement(principal)) {
        return sendError(
          c,
          403,
          "ROLE_REQUIRED",
          "Confirming payments requires a procurement/management role",
        );
      }
      const paymentId = c.req.param("id");
      await deps.payments.confirmIntent({ id: paymentId });
      const confirmed = await deps.trust.confirmPaymentIntent(
        principal.scope.tenantId,
        paymentId,
      );
      if (!confirmed) {
        return sendError(c, 404, "NOT_FOUND", "Payment intent not found");
      }
      return c.json({ data: confirmed });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/payments/intents", async (c) => {
    try {
      const principal = c.get("principal");
      return c.json({
        data: await deps.trust.listPayments(principal.scope.tenantId),
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/signatures", async (c) => {
    try {
      const principal = c.get("principal");
      const body = signatureSchema.parse(await c.req.json());
      const user = await deps.users.findById(principal.userId);
      const signature = await deps.trust.createSignature({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        subjectType: body.subjectType,
        subjectId: body.subjectId,
        signerName: body.signerName || user?.displayName || "Signer",
        signerUserId: principal.userId,
        purpose: body.purpose,
        imageDataUrl: body.imageDataUrl,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: signature }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
