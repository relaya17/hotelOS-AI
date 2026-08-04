import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { AuditRepository, MarketingLeadsRepository } from "@hotelos/database";
import type { Logger } from "@hotelos/logger";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { mapUnknownError } from "./errors.js";

export type LeadsRouteDeps = {
  readonly leads: MarketingLeadsRepository;
  /** Platform/demo tenant used only for audit_events FK (anonymous www leads). */
  readonly auditTenantId?: string;
  readonly audit?: AuditRepository;
  readonly logger?: Logger;
};

const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  hotelOrChain: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(254),
  note: z.string().trim().max(2000).optional(),
  source: z.string().trim().min(1).max(64).default("www_contact"),
});

export function createLeadsRoutes(deps: LeadsRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/", async (c) => {
    try {
      const body = createLeadSchema.parse(await c.req.json());
      const note = body.note?.trim() ? body.note.trim() : null;
      const created = await deps.leads.create({
        id: randomUUID(),
        name: body.name,
        hotelOrChain: body.hotelOrChain,
        email: body.email.toLowerCase(),
        note,
        source: body.source,
        createdAt: new Date().toISOString(),
      });

      deps.logger?.info("marketing lead created", {
        leadId: created.id,
        source: created.source,
        hotelOrChain: created.hotelOrChain,
      });

      if (deps.audit && deps.auditTenantId) {
        try {
          await deps.audit.append({
            id: randomUUID(),
            tenantId: Ids.tenant(deps.auditTenantId),
            action: "marketing.lead.created",
            resourceType: "marketing_lead",
            resourceId: created.id,
            metadata: {
              source: created.source,
              hotelOrChain: created.hotelOrChain,
              emailDomain: created.email.includes("@")
                ? (created.email.split("@")[1] ?? null)
                : null,
              hasNote: note !== null,
            },
            createdAt: created.createdAt,
          });
        } catch (auditError) {
          deps.logger?.warn("marketing lead audit write failed", {
            leadId: created.id,
            message:
              auditError instanceof Error
                ? auditError.message
                : String(auditError),
          });
        }
      }

      return c.json(
        {
          data: {
            id: created.id,
            createdAt: created.createdAt,
          },
        },
        201,
      );
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
