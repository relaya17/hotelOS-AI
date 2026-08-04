import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Anonymous marketing leads from www (and future surfaces). No tenant FK. */
export const marketingLeads = sqliteTable(
  "marketing_leads",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    hotelOrChain: text("hotel_or_chain").notNull(),
    email: text("email").notNull(),
    note: text("note"),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("marketing_leads_email_idx").on(table.email),
    index("marketing_leads_created_idx").on(table.createdAt),
  ],
);
