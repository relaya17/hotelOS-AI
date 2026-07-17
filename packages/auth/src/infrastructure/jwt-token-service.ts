import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { Ids } from "@hotelos/shared";
import {
  accessTokenClaimsSchema,
  type AccessTokenClaims,
} from "../application/token-claims.js";
import { AuthError } from "../domain/errors.js";
import type { AuthPrincipal } from "../domain/tenancy.js";

export type TokenPair = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenHash: string;
  readonly refreshExpiresAt: string;
};

export type JwtTokenService = {
  issuePair: (principal: AuthPrincipal) => Promise<TokenPair>;
  verifyAccessToken: (token: string) => Promise<AuthPrincipal>;
  hashRefreshToken: (token: string) => string;
};

export type JwtSecrets = {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessTtlSeconds: number;
  readonly refreshTtlSeconds: number;
};

function toPrincipal(claims: AccessTokenClaims): AuthPrincipal {
  const scope: AuthPrincipal["scope"] = {
    tenantId: Ids.tenant(claims.tenantId),
  };
  if (claims.chainId !== undefined) {
    (scope as { chainId: ReturnType<typeof Ids.chain> }).chainId = Ids.chain(
      claims.chainId,
    );
  }
  if (claims.hotelId !== undefined) {
    (scope as { hotelId: ReturnType<typeof Ids.hotel> }).hotelId = Ids.hotel(
      claims.hotelId,
    );
  }
  if (claims.departmentId !== undefined) {
    (
      scope as { departmentId: ReturnType<typeof Ids.department> }
    ).departmentId = Ids.department(claims.departmentId);
  }

  return {
    userId: Ids.user(claims.sub),
    roles: claims.roles,
    scope,
  };
}

export function createJwtTokenService(secrets: JwtSecrets): JwtTokenService {
  const accessKey = new TextEncoder().encode(secrets.accessSecret);
  // refreshSecret reserved for future signed refresh envelopes / key separation.
  void secrets.refreshSecret;

  return {
    hashRefreshToken(token) {
      return createHash("sha256").update(token).digest("hex");
    },

    async issuePair(principal) {
      const claims: AccessTokenClaims = {
        sub: principal.userId,
        tenantId: principal.scope.tenantId,
        roles: [...principal.roles],
        typ: "access",
        ...(principal.scope.chainId !== undefined
          ? { chainId: principal.scope.chainId }
          : {}),
        ...(principal.scope.hotelId !== undefined
          ? { hotelId: principal.scope.hotelId }
          : {}),
        ...(principal.scope.departmentId !== undefined
          ? { departmentId: principal.scope.departmentId }
          : {}),
      };

      const accessToken = await new SignJWT({ ...claims })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${secrets.accessTtlSeconds}s`)
        .sign(accessKey);

      const refreshToken = randomBytes(32).toString("base64url");
      const refreshExpiresAt = new Date(
        Date.now() + secrets.refreshTtlSeconds * 1000,
      ).toISOString();

      return {
        accessToken,
        refreshToken,
        refreshTokenHash: createHash("sha256")
          .update(refreshToken)
          .digest("hex"),
        refreshExpiresAt,
      };
    },

    async verifyAccessToken(token) {
      try {
        const verified = await jwtVerify(token, accessKey);
        const claims = accessTokenClaimsSchema.parse(verified.payload);
        return toPrincipal(claims);
      } catch {
        throw new AuthError("INVALID_TOKEN", "Access token is invalid");
      }
    },
  };
}
