import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { MarketingLeadsRepository } from "@hotelos/database";
import { z } from "@hotelos/validation";
import { mapUnknownError } from "./errors.js";

export type LeadsRouteDeps = {
  readonly leads: MarketingLeadsRepository;
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
