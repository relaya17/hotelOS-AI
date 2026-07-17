import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hotelChains, hotels, tenants, users } from "./tenancy.js";

/**
 * ADR 0007 — CIO orchestrator, Trusted knowledge, Kashrut supervisor, org comms.
 * Direct channels across the hierarchy (owner ↔ CEO ↔ departments, kashrut ↔ F&B/GM).
 * `hotelId` is null for chain-wide channels (e.g. owner ↔ CEO) and set for
 * hotel-scoped lanes (e.g. kashrut ↔ F&B at a specific property).
 */
export const orgCommsChannels = sqliteTable(
  "org_comms_channels",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    chainId: text("chain_id")
      .notNull()
      .references(() => hotelChains.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    channelKey: text("channel_key").notNull(),
    nameHe: text("name_he").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("org_comms_channels_tenant_idx").on(table.tenantId),
    index("org_comms_channels_chain_idx").on(table.chainId),
    index("org_comms_channels_hotel_idx").on(table.hotelId),
    index("org_comms_channels_key_idx").on(table.channelKey),
  ],
);

export const orgCommsMessages = sqliteTable(
  "org_comms_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    channelId: text("channel_id")
      .notNull()
      .references(() => orgCommsChannels.id),
    fromRole: text("from_role").notNull(),
    body: text("body").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("org_comms_messages_tenant_idx").on(table.tenantId),
    index("org_comms_messages_channel_idx").on(table.channelId),
  ],
);

/**
 * Allowlisted external knowledge (ADR 0007 §2). Only these sources may back
 * `agent.cio` / `agent.kashrut` "Trusted" citations — open web search is
 * discovery-only and never actionable without an approved entry here.
 */
export const trustedSources = sqliteTable(
  "trusted_sources",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    title: text("title").notNull(),
    url: text("url").notNull(),
    category: text("category").notNull(),
    approvedAt: text("approved_at").notNull(),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("trusted_sources_tenant_idx").on(table.tenantId),
    index("trusted_sources_category_idx").on(table.category),
  ],
);

/**
 * "Always can say something" model (ADR 0007 / kashrut-agent.md §"תמיד יכול
 * להגיד"): every kashrut-relevant artifact carries a status the human
 * משגיח or `agent.kashrut` can attach, independent of the target's own flow.
 */
export const kashrutAnnotations = sqliteTable(
  "kashrut_annotations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    status: text("status").notNull(),
    message: text("message"),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("kashrut_annotations_tenant_idx").on(table.tenantId),
    index("kashrut_annotations_hotel_idx").on(table.hotelId),
    index("kashrut_annotations_target_idx").on(
      table.targetKind,
      table.targetId,
    ),
  ],
);
