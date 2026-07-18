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

export const assessmentTemplates = sqliteTable(
  "assessment_templates",
  {
    id: text("id").primaryKey(),
    /** null = global shared catalog */
    tenantId: text("tenant_id").references(() => tenants.id),
    titleHe: text("title_he").notNull(),
    titleEn: text("title_en").notNull(),
    category: text("category").notNull(),
    passingScore: text("passing_score").notNull(),
    questionsJson: text("questions_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("assessment_templates_tenant_idx").on(table.tenantId)],
);

export const assessmentAssignments = sqliteTable(
  "assessment_assignments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employeeProfiles.id),
    templateId: text("template_id")
      .notNull()
      .references(() => assessmentTemplates.id),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull(),
    dueAt: text("due_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("assessment_assignments_tenant_idx").on(table.tenantId),
    index("assessment_assignments_employee_idx").on(table.employeeId),
  ],
);

export const assessmentResults = sqliteTable(
  "assessment_results",
  {
    id: text("id").primaryKey(),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => assessmentAssignments.id),
    score: text("score").notNull(),
    passed: text("passed").notNull(),
    answersJson: text("answers_json").notNull(),
    completedAt: text("completed_at").notNull(),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("assessment_results_assignment_uidx").on(table.assignmentId),
  ],
);
