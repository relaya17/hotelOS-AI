import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { hotels, tenants, users } from "./tenancy.js";
import { employeeProfiles } from "./turbo.js";

export const cookieConsents = sqliteTable(
  "cookie_consents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id),
    subjectKey: text("subject_key").notNull(),
    necessary: text("necessary").notNull(),
    functional: text("functional").notNull(),
    policyVersion: text("policy_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("cookie_consents_subject_idx").on(table.subjectKey)],
);

export const paymentIntents = sqliteTable(
  "payment_intents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id").references(() => hotels.id),
    amountMinor: text("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    description: text("description").notNull(),
    payerEmail: text("payer_email"),
    provider: text("provider").notNull(),
    createdAt: text("created_at").notNull(),
    confirmedAt: text("confirmed_at"),
  },
  (table) => [
    index("payment_intents_tenant_idx").on(table.tenantId),
    index("payment_intents_hotel_idx").on(table.hotelId),
  ],
);

export const digitalSignatures = sqliteTable(
  "digital_signatures",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    signerName: text("signer_name").notNull(),
    signerUserId: text("signer_user_id").references(() => users.id),
    purpose: text("purpose").notNull(),
    imageDataUrl: text("image_data_url").notNull(),
    contentHash: text("content_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("digital_signatures_tenant_idx").on(table.tenantId),
    index("digital_signatures_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const webauthnCredentials = sqliteTable(
  "webauthn_credentials",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    credentialId: text("credential_id").notNull(),
    publicKeyJwkJson: text("public_key_jwk_json").notNull(),
    deviceLabel: text("device_label").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("webauthn_credentials_user_idx").on(table.userId),
    uniqueIndex("webauthn_credentials_cred_uidx").on(table.credentialId),
  ],
);

export const authChallenges = sqliteTable(
  "auth_challenges",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id").references(() => users.id),
    purpose: text("purpose").notNull(),
    challenge: text("challenge").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("auth_challenges_challenge_idx").on(table.challenge)],
);

export const oauthIdentities = sqliteTable(
  "oauth_identities",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    email: text("email").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("oauth_identities_provider_subject_uidx").on(
      table.provider,
      table.providerSubject,
    ),
  ],
);

export const voiceEnrollments = sqliteTable(
  "voice_enrollments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    phrase: text("phrase").notNull(),
    sampleHash: text("sample_hash").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("voice_enrollments_user_idx").on(table.userId)],
);

export const attendanceEvents = sqliteTable(
  "attendance_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    hotelId: text("hotel_id")
      .notNull()
      .references(() => hotels.id),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employeeProfiles.id),
    userId: text("user_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    latitude: text("latitude"),
    longitude: text("longitude"),
    accuracyMeters: text("accuracy_meters"),
    deviceLabel: text("device_label").notNull(),
    signatureId: text("signature_id"),
    voiceVerified: text("voice_verified").notNull(),
    webauthnVerified: text("webauthn_verified").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("attendance_events_tenant_idx").on(table.tenantId),
    index("attendance_events_employee_idx").on(table.employeeId),
    index("attendance_events_hotel_idx").on(table.hotelId),
  ],
);
