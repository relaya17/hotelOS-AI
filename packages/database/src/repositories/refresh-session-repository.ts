import { and, eq, isNull } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { refreshSessions } from "../schema/tenancy.js";

export type RefreshSession = {
  readonly id: string;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  readonly tokenHash: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
};

export type RefreshSessionRepository = {
  create: (input: {
    id: string;
    userId: UserId;
    tenantId: TenantId;
    tokenHash: string;
    expiresAt: string;
    createdAt: string;
  }) => Promise<void>;
  findActiveByTokenHash: (tokenHash: string) => Promise<RefreshSession | null>;
  revoke: (id: string, revokedAt: string) => Promise<void>;
};

export function createRefreshSessionRepository(
  db: HotelOsDb,
): RefreshSessionRepository {
  return {
    async create(input) {
      db.insert(refreshSessions)
        .values({
          id: input.id,
          userId: input.userId,
          tenantId: input.tenantId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          revokedAt: null,
          createdAt: input.createdAt,
        })
        .run();
    },
    async findActiveByTokenHash(tokenHash) {
      const row = db
        .select()
        .from(refreshSessions)
        .where(
          and(
            eq(refreshSessions.tokenHash, tokenHash),
            isNull(refreshSessions.revokedAt),
          ),
        )
        .get();
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: Ids.user(row.userId),
        tenantId: Ids.tenant(row.tenantId),
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
      };
    },
    async revoke(id, revokedAt) {
      db.update(refreshSessions)
        .set({ revokedAt })
        .where(eq(refreshSessions.id, id))
        .run();
    },
  };
}
