import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hotels, tenants, users } from "./tenancy.js";

export const letterDrafts = sqliteTable(
  "letter_drafts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    recipientLabel: text("recipient_label").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("letter_drafts_tenant_idx").on(table.tenantId),
    index("letter_drafts_status_idx").on(table.status),
  ],
);

export const aiApprovalRequests = sqliteTable(
  "ai_approval_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    agentId: text("agent_id").notNull(),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    summaryHe: text("summary_he").notNull(),
    reasonHe: text("reason_he").notNull(),
    payloadJson: text("payload_json").notNull(),
    status: text("status").notNull(),
    decidedByUserId: text("decided_by_user_id").references(() => users.id),
    decidedAt: text("decided_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("ai_approval_requests_tenant_idx").on(table.tenantId),
    index("ai_approval_requests_status_idx").on(table.status),
  ],
);
