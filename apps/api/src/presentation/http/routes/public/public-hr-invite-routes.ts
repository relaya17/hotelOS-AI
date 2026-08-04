import { Hono } from "hono";
import {
  completeInviteSchema,
  completePublicInvite,
} from "../../hr-routes.js";
import { mapUnknownError, sendError } from "../../errors.js";
import type { PublicRouteDeps } from "./public-deps.js";

export function createPublicHrInviteRoutes(deps: PublicRouteDeps): Hono {
  const routes = new Hono();

  routes.get("/hr/invites/:token", async (c) => {
    try {
      const invite = await deps.hr.findInviteByToken(c.req.param("token"));
      if (!invite) {
        return sendError(c, 404, "INVITE_NOT_FOUND", "Invite not found");
      }
      if (invite.consumedAt) {
        return sendError(c, 409, "INVITE_CONSUMED", "Invite already used");
      }
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return sendError(c, 410, "INVITE_EXPIRED", "Invite expired");
      }
      return c.json({
        data: {
          email: invite.email,
          displayNameHint: invite.displayNameHint,
          roleHint: invite.roleHint,
          hotelId: invite.hotelId,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/hr/invites/:token/complete", async (c) => {
    try {
      const body = completeInviteSchema.parse(await c.req.json());
      const result = await completePublicInvite(
        deps.hr,
        c.req.param("token"),
        body,
      );
      if (!result.ok) {
        const map = {
          NOT_FOUND: [404, "INVITE_NOT_FOUND", "Invite not found"],
          EXPIRED: [410, "INVITE_EXPIRED", "Invite expired"],
          CONSUMED: [409, "INVITE_CONSUMED", "Invite already used"],
          EMAIL_TAKEN: [409, "EMAIL_TAKEN", "Email already registered"],
        } as const;
        const [status, code, message] = map[result.reason];
        return sendError(c, status, code, message);
      }
      return c.json(
        {
          data: {
            employeeId: result.employee.id,
            employeeCode: result.employee.employeeCode,
            userId: result.userId,
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
