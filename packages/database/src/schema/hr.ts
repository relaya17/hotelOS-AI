import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { departments, hotels, tenants, users } from "./tenancy.js";
import { employeeProfiles } from "./turbo.js";

export const employeeInvites = sqliteTable(
  "employee_invites",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    departmentId: text("department_id").references(() => departments.id),
    email: text("email").notNull(),
    displayNameHint: text("display_name_hint").notNull(),
    roleHint: text("role_hint").notNull(),
    inviteTokenHash: text("invite_token_hash").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("employee_invites_tenant_idx").on(table.tenantId),
    uniqueIndex("employee_invites_token_hash_uidx").on(table.inviteTokenHash),
  ],
);

export const employeeDocuments = sqliteTable(
  "employee_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employeeProfiles.id),
    docType: text("doc_type").notNull(),
    /** Hash/flag only for sensitive docs (PO: no full scan stored in HotelOS). */
    contentHash: text("content_hash"),
    issuingAuthority: text("issuing_authority"),
    issuedAt: text("issued_at"),
    expiresAt: text("expires_at"),
    status: text("status").notNull(),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: text("reviewed_at"),
    notes: text("notes"),
    uploadedAt: text("uploaded_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("employee_documents_tenant_idx").on(table.tenantId),
    index("employee_documents_employee_idx").on(table.employeeId),
  ],
);
