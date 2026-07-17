import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const hotelChains = sqliteTable(
  "hotel_chains",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("hotel_chains_tenant_idx").on(table.tenantId)],
);

export const hotels = sqliteTable(
  "hotels",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    chainId: text("chain_id")
      .notNull()
      .references(() => hotelChains.id),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("hotels_tenant_idx").on(table.tenantId),
    index("hotels_chain_idx").on(table.chainId),
  ],
);

export const departments = sqliteTable(
  "departments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("departments_hotel_idx").on(table.hotelId),
    index("departments_tenant_idx").on(table.tenantId),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    chainId: text("chain_id").references(() => hotelChains.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    departmentId: text("department_id").references(() => departments.id),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    rolesJson: text("roles_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("users_tenant_email_idx").on(table.tenantId, table.email),
    index("users_hotel_idx").on(table.hotelId),
  ],
);

export const refreshSessions = sqliteTable(
  "refresh_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("refresh_sessions_user_idx").on(table.userId),
    index("refresh_sessions_tenant_idx").on(table.tenantId),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    hotelId: text("hotel_id"),
    actorUserId: text("actor_user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    correlationId: text("correlation_id"),
    metadataJson: text("metadata_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("audit_events_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);
