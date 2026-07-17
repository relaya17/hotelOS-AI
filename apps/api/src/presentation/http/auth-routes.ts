import { Hono } from "hono";
import { z } from "@hotelos/validation";
import {
  loginUser,
  type JwtTokenService,
  AuthError,
} from "@hotelos/auth";
import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import type { UserRepository } from "@hotelos/database";
import type { RefreshSessionRepository } from "@hotelos/database";
import type { AuditRepository } from "@hotelos/database";
import { mapUnknownError, sendError } from "./errors.js";

const loginSchema = z.object({
  tenantId: z.string().uuid(),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

export type AuthRouteDeps = {
  readonly users: UserRepository;
  readonly sessions: RefreshSessionRepository;
  readonly audit: AuditRepository;
  readonly tokens: JwtTokenService;
};

export function createAuthRoutes(deps: AuthRouteDeps): Hono {
  const routes = new Hono();

  routes.post("/login", async (c) => {
    try {
      const body = loginSchema.parse(await c.req.json());
      const result = await loginUser(
        {
          findByTenantAndEmail: async (tenantId, email) =>
            deps.users.findByTenantAndEmail(tenantId, email),
        },
        {
          tenantId: Ids.tenant(body.tenantId),
          email: body.email,
          password: body.password,
        },
      );

      if (!result.ok) {
        return sendError(c, 401, result.error.code, result.error.message);
      }

      const pair = await deps.tokens.issuePair(result.value.principal);
      const now = new Date().toISOString();
      await deps.sessions.create({
        id: randomUUID(),
        userId: result.value.principal.userId,
        tenantId: result.value.principal.scope.tenantId,
        tokenHash: pair.refreshTokenHash,
        expiresAt: pair.refreshExpiresAt,
        createdAt: now,
      });

      await deps.audit.append({
        id: randomUUID(),
        tenantId: result.value.principal.scope.tenantId,
        actorUserId: result.value.principal.userId,
        action: "auth.login",
        resourceType: "user",
        resourceId: result.value.principal.userId,
        metadata: { email: result.value.email },
        createdAt: now,
        ...(result.value.principal.scope.hotelId !== undefined
          ? { hotelId: result.value.principal.scope.hotelId }
          : {}),
      });

      return c.json({
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
        user: {
          id: result.value.principal.userId,
          email: result.value.email,
          displayName: result.value.displayName,
          roles: result.value.principal.roles,
          scope: result.value.principal.scope,
        },
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/refresh", async (c) => {
    try {
      const body = refreshSchema.parse(await c.req.json());
      const tokenHash = deps.tokens.hashRefreshToken(body.refreshToken);
      const session = await deps.sessions.findActiveByTokenHash(tokenHash);
      if (!session) {
        throw new AuthError("UNAUTHORIZED", "Refresh session invalid");
      }
      if (Date.parse(session.expiresAt) <= Date.now()) {
        await deps.sessions.revoke(session.id, new Date().toISOString());
        throw new AuthError("UNAUTHORIZED", "Refresh session expired");
      }

      const user = await deps.users.findById(session.userId);
      if (!user) {
        throw new AuthError("UNAUTHORIZED", "User not found");
      }

      await deps.sessions.revoke(session.id, new Date().toISOString());

      const scope = {
        tenantId: user.tenantId,
        ...(user.chainId !== null ? { chainId: Ids.chain(user.chainId) } : {}),
        ...(user.hotelId !== null ? { hotelId: Ids.hotel(user.hotelId) } : {}),
        ...(user.departmentId !== null
          ? { departmentId: Ids.department(user.departmentId) }
          : {}),
      };

      const principal = {
        userId: user.id,
        roles: user.roles,
        scope,
      };

      const pair = await deps.tokens.issuePair(principal);
      const now = new Date().toISOString();
      await deps.sessions.create({
        id: randomUUID(),
        userId: user.id,
        tenantId: user.tenantId,
        tokenHash: pair.refreshTokenHash,
        expiresAt: pair.refreshExpiresAt,
        createdAt: now,
      });

      return c.json({
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.get("/me", async (c) => {
    try {
      const header = c.req.header("authorization");
      if (header === undefined || !header.startsWith("Bearer ")) {
        throw new AuthError("UNAUTHORIZED", "Missing bearer token");
      }
      const token = header.slice("Bearer ".length);
      const principal = await deps.tokens.verifyAccessToken(token);
      const user = await deps.users.findById(principal.userId);
      if (!user) {
        throw new AuthError("UNAUTHORIZED", "User not found");
      }
      return c.json({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        scope: principal.scope,
      });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  routes.post("/logout", async (c) => {
    try {
      const body = refreshSchema.parse(await c.req.json());
      const tokenHash = deps.tokens.hashRefreshToken(body.refreshToken);
      const session = await deps.sessions.findActiveByTokenHash(tokenHash);
      if (session) {
        await deps.sessions.revoke(session.id, new Date().toISOString());
        await deps.audit.append({
          id: randomUUID(),
          tenantId: session.tenantId,
          actorUserId: session.userId,
          action: "auth.logout",
          resourceType: "refresh_session",
          resourceId: session.id,
          metadata: {},
          createdAt: new Date().toISOString(),
        });
      }
      return c.json({ data: { ok: true } });
    } catch (error) {
      return mapUnknownError(c, error);
    }
  });

  return routes;
}
