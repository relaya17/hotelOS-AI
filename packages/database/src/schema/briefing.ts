import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { hotelChains, tenants, users } from "./tenancy.js";

/** Platform agent catalog — shared across tenants; scoped at runtime by RBAC. */
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  nameHe: text("name_he").notNull(),
  nameEn: text("name_en").notNull(),
  domain: text("domain").notNull(),
  summaryHe: text("summary_he").notNull(),
  autonomyMode: text("autonomy_mode").notNull(),
  createdAt: text("created_at").notNull(),
});

export const briefingRooms = sqliteTable(
  "briefing_rooms",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    chainId: text("chain_id")
      .notNull()
      .references(() => hotelChains.id),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    status: text("status").notNull(),
    hostUserId: text("host_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("briefing_rooms_tenant_idx").on(table.tenantId),
    index("briefing_rooms_chain_idx").on(table.chainId),
  ],
);

export const briefingParticipants = sqliteTable(
  "briefing_participants",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => briefingRooms.id),
    displayName: text("display_name").notNull(),
    roleLabel: text("role_label").notNull(),
    userId: text("user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("briefing_participants_room_idx").on(table.roomId)],
);

export const briefingSharedAgents = sqliteTable(
  "briefing_shared_agents",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => briefingRooms.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id),
    sharedByUserId: text("shared_by_user_id")
      .notNull()
      .references(() => users.id),
    sharedAt: text("shared_at").notNull(),
  },
  (table) => [
    index("briefing_shared_agents_room_idx").on(table.roomId),
    uniqueIndex("briefing_shared_agents_room_agent_uidx").on(
      table.roomId,
      table.agentId,
    ),
  ],
);

export const briefingMessages = sqliteTable(
  "briefing_messages",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => briefingRooms.id),
    speakerKind: text("speaker_kind").notNull(),
    speakerId: text("speaker_id").notNull(),
    speakerName: text("speaker_name").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("briefing_messages_room_idx").on(table.roomId)],
);

/**
 * Meeting recordings — row always scoped by tenant + chain + room.
 * Media files live under RECORDINGS_PATH/{tenantId}/{chainId}/{roomId}/
 */
export const briefingRecordings = sqliteTable(
  "briefing_recordings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    chainId: text("chain_id")
      .notNull()
      .references(() => hotelChains.id),
    roomId: text("room_id")
      .notNull()
      .references(() => briefingRooms.id),
    status: text("status").notNull(),
    startedByUserId: text("started_by_user_id")
      .notNull()
      .references(() => users.id),
    startedAt: text("started_at").notNull(),
    endedAt: text("ended_at"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    byteSize: text("byte_size"),
    durationSeconds: text("duration_seconds"),
    transcriptJson: text("transcript_json"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("briefing_recordings_tenant_idx").on(table.tenantId),
    index("briefing_recordings_chain_idx").on(table.chainId),
    index("briefing_recordings_room_idx").on(table.roomId),
    index("briefing_recordings_tenant_room_idx").on(
      table.tenantId,
      table.roomId,
    ),
  ],
);
