import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { OrgCommsRepository } from "@hotelos/database";
import type { JwtTokenService } from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { z } from "@hotelos/validation";
import { requireAuth, type AuthVariables } from "./auth-middleware.js";
import { mapUnknownError, sendError } from "./errors.js";

export type OrgCommsRouteDeps = {
  readonly orgComms: OrgCommsRepository;
  readonly tokens: JwtTokenService;
};

const createChannelSchema = z.object({
  channelKey: z.string().trim().min(2).max(60),
  nameHe: z.string().trim().min(2).max(160),
  hotelId: z.string().uuid().optional(),
  chainId: z.string().uuid(),
});

const createMessageSchema = z.object({
  fromRole: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(4000),
});

export function createOrgCommsRoutes(deps: OrgCommsRouteDeps): Hono<{
  Variables: AuthVariables;
}> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  routes.use("*", requireAuth(deps.tokens));

  routes.get("/channels", async (c) => {
    try {
      const principal = c.get("principal");
      const list = await deps.orgComms.listChannels(principal.scope.tenantId);
      const scoped = principal.scope.hotelId
        ? list.filter(
            (channel) =>
              channel.hotelId === null || channel.hotelId === principal.scope.hotelId,
          )
        : list;
      return c.json({ data: scoped });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/channels", async (c) => {
    try {
      const principal = c.get("principal");
      const body = createChannelSchema.parse(await c.req.json());
      const created = await deps.orgComms.createChannel({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        chainId: Ids.chain(body.chainId),
        ...(body.hotelId ? { hotelId: Ids.hotel(body.hotelId) } : {}),
        channelKey: body.channelKey,
        nameHe: body.nameHe,
        createdAt: new Date().toISOString(),
      });
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/channels/:channelId/messages", async (c) => {
    try {
      const principal = c.get("principal");
      const channelId = c.req.param("channelId");
      const list = await deps.orgComms.listMessages(principal.scope.tenantId, channelId);
      return c.json({ data: list });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/channels/:channelId/messages", async (c) => {
    try {
      const principal = c.get("principal");
      const channelId = c.req.param("channelId");
      const body = createMessageSchema.parse(await c.req.json());
      const created = await deps.orgComms.addMessage({
        id: randomUUID(),
        tenantId: principal.scope.tenantId,
        channelId,
        fromRole: body.fromRole,
        body: body.body,
        createdByUserId: principal.userId,
        createdAt: new Date().toISOString(),
      });
      if (!created) {
        return sendError(c, 404, "CHANNEL_NOT_FOUND", "Channel not found");
      }
      return c.json({ data: created }, 201);
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
