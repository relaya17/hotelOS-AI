import { and, eq } from "drizzle-orm";
import type { TenantId, UserId } from "@hotelos/shared";
import { Ids } from "@hotelos/shared";
import type { HotelOsDb } from "../client.js";
import { users } from "../schema/tenancy.js";

export type PersistedUser = {
  readonly id: UserId;
  readonly tenantId: TenantId;
  readonly chainId: string | null;
  readonly hotelId: string | null;
  readonly departmentId: string | null;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly roles: readonly string[];
};

export type UserRepository = {
  findByTenantAndEmail: (
    tenantId: TenantId,
    email: string,
  ) => Promise<PersistedUser | null>;
  findById: (userId: UserId) => Promise<PersistedUser | null>;
};

function mapUser(row: typeof users.$inferSelect): PersistedUser {
  const rolesUnknown: unknown = JSON.parse(row.rolesJson);
  if (
    !Array.isArray(rolesUnknown) ||
    !rolesUnknown.every((role) => typeof role === "string")
  ) {
    throw new Error("INVALID_ROLES_JSON");
  }

  return {
    id: Ids.user(row.id),
    tenantId: Ids.tenant(row.tenantId),
    chainId: row.chainId,
    hotelId: row.hotelId,
    departmentId: row.departmentId,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    roles: rolesUnknown,
  };
}

export function createUserRepository(db: HotelOsDb): UserRepository {
  return {
    async findByTenantAndEmail(tenantId, email) {
      const normalized = email.trim().toLowerCase();
      const row = await db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.email, normalized)))
        .get();
      return row ? mapUser(row) : null;
    },
    async findById(userId) {
      const row = await db.select().from(users).where(eq(users.id, userId)).get();
      return row ? mapUser(row) : null;
    },
  };
}
