import type { MiddlewareHandler } from "hono";
import { AuthError, type AuthPrincipal, type JwtTokenService } from "@hotelos/auth";
import { mapUnknownError, sendError } from "./errors.js";

export type AuthVariables = {
  principal: AuthPrincipal;
};

export function requireAuth(tokens: JwtTokenService): MiddlewareHandler<{
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    try {
      const header = c.req.header("authorization");
      if (header === undefined || !header.startsWith("Bearer ")) {
        return sendError(c, 401, "UNAUTHORIZED", "Missing bearer token");
      }
      const token = header.slice("Bearer ".length);
      const principal = await tokens.verifyAccessToken(token);
      c.set("principal", principal);
      await next();
    } catch (error) {
      if (error instanceof AuthError) {
        return mapUnknownError(c, error);
      }
      return mapUnknownError(c, error);
    }
  };
}
