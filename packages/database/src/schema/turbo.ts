import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { hotels, tenants, users } from "./tenancy.js";

export const employeeProfiles = sqliteTable(
  "employee_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id").references(() => users.id),
    displayName: text("display_name").notNull(),
    roleLabel: text("role_label").notNull(),
    preferredLocale: text("preferred_locale").notNull(),
    hotelId: text("hotel_id").references(() => hotels.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("employee_profiles_tenant_idx").on(table.tenantId)],
);

export const staffChatMessages = sqliteTable(
  "staff_chat_messages",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    channel: text("channel").notNull(),
    authorName: text("author_name").notNull(),
    authorUserId: text("author_user_id").references(() => users.id),
    sourceLocale: text("source_locale").notNull(),
    sourceBody: text("source_body").notNull(),
    translationsJson: text("translations_json").notNull(),
    verification: text("verification").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("staff_chat_messages_tenant_idx").on(table.tenantId),
    index("staff_chat_messages_channel_idx").on(table.channel),
  ],
);

export const ledgerAccounts = sqliteTable(
  "ledger_accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    accountType: text("account_type").notNull(),
    currency: text("currency").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("ledger_accounts_tenant_idx").on(table.tenantId)],
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    accountId: text("account_id")
      .notNull()
      .references(() => ledgerAccounts.id),
    memo: text("memo").notNull(),
    debit: integer("debit").notNull(),
    credit: integer("credit").notNull(),
    entryDate: text("entry_date").notNull(),
    sourceSystem: text("source_system").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("journal_entries_tenant_idx").on(table.tenantId),
    index("journal_entries_account_idx").on(table.accountId),
  ],
);

export const automations = sqliteTable(
  "automations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    triggerKey: text("trigger_key").notNull(),
    actionKey: text("action_key").notNull(),
    enabled: integer("enabled").notNull(),
    lastRunAt: text("last_run_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("automations_tenant_idx").on(table.tenantId)],
);

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id),
    status: text("status").notNull(),
    detail: text("detail").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("automation_runs_tenant_idx").on(table.tenantId)],
);
