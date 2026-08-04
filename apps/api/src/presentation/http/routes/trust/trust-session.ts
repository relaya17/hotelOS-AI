import { Ids } from "@hotelos/shared";
import { randomUUID } from "node:crypto";
import type { TrustRouteDeps } from "./trust-deps.js";

export type SessionUser = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string | null;
  readonly hotelId: string | null;
  readonly departmentId: string | null;
  readonly email: string;
  readonly displayName: string;
  readonly roles: readonly string[];
};

export type SessionPayload = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly roles: readonly string[];
    readonly scope: {
      readonly tenantId: string;
      readonly chainId?: string;
      readonly hotelId?: string;
      readonly departmentId?: string;
    };
  };
};

export async function buildSessionPayload(
  deps: TrustRouteDeps,
  user: SessionUser,
  action: string,
): Promise<SessionPayload> {
  const scope: {
    tenantId: ReturnType<typeof Ids.tenant>;
    chainId?: ReturnType<typeof Ids.chain>;
    hotelId?: ReturnType<typeof Ids.hotel>;
    departmentId?: ReturnType<typeof Ids.department>;
  } = { tenantId: Ids.tenant(user.tenantId) };
  if (user.chainId) scope.chainId = Ids.chain(user.chainId);
  if (user.hotelId) scope.hotelId = Ids.hotel(user.hotelId);
  if (user.departmentId) scope.departmentId = Ids.department(user.departmentId);

  const principal = {
    userId: Ids.user(user.id),
    roles: user.roles,
    scope,
  };
  const pair = await deps.tokens.issuePair(principal);
  await deps.sessions.create({
    id: randomUUID(),
    userId: principal.userId,
    tenantId: principal.scope.tenantId,
    tokenHash: pair.refreshTokenHash,
    expiresAt: pair.refreshExpiresAt,
    createdAt: new Date().toISOString(),
  });
  await deps.audit.append({
    id: randomUUID(),
    tenantId: principal.scope.tenantId,
    actorUserId: principal.userId,
    action,
    resourceType: "user",
    resourceId: principal.userId,
    metadata: { email: user.email },
    createdAt: new Date().toISOString(),
    ...(principal.scope.hotelId !== undefined
      ? { hotelId: principal.scope.hotelId }
      : {}),
  });

  return {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles,
      scope: {
        tenantId: user.tenantId,
        ...(user.chainId ? { chainId: user.chainId } : {}),
        ...(user.hotelId ? { hotelId: user.hotelId } : {}),
        ...(user.departmentId ? { departmentId: user.departmentId } : {}),
      },
    },
  };
}

export async function issueSessionForUser(
  deps: TrustRouteDeps,
  c: { json: (body: unknown, status?: number) => Response },
  user: SessionUser,
  action: string,
): Promise<Response> {
  return c.json(await buildSessionPayload(deps, user, action));
}
