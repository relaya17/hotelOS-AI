import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as briefingSchema from "./schema/briefing.js";
import * as tenancySchema from "./schema/tenancy.js";
import * as trustSchema from "./schema/trust.js";
import * as turboSchema from "./schema/turbo.js";

const schema = {
  ...tenancySchema,
  ...briefingSchema,
  ...turboSchema,
  ...trustSchema,
};

export type HotelOsSchema = typeof schema;
export type HotelOsDb = LibSQLDatabase<HotelOsSchema>;

export type DbHandle = {
  readonly db: HotelOsDb;
  readonly close: () => void;
};

export type DbConfig = {
  readonly url: string;
  readonly authToken?: string;
};

export async function createDb(config: DbConfig | string): Promise<DbHandle> {
  const { url, authToken } =
    typeof config === "string" ? { url: `file:${config}`, authToken: undefined } : config;

  if (url.startsWith("file:")) {
    mkdirSync(dirname(url.slice("file:".length)), { recursive: true });
  }

  const client = createClient({
    url,
    ...(authToken !== undefined ? { authToken } : {}),
  });
  await migrate(client);
  const db = drizzle(client, { schema });
  return {
    db,
    close: () => {
      client.close();
    },
  };
}

export async function migrate(client: Client): Promise<void> {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hotel_chains (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hotel_chains_tenant_idx ON hotel_chains(tenant_id);

    CREATE TABLE IF NOT EXISTS hotels (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      chain_id TEXT NOT NULL REFERENCES hotel_chains(id),
      name TEXT NOT NULL,
      timezone TEXT NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS hotels_tenant_idx ON hotels(tenant_id);
    CREATE INDEX IF NOT EXISTS hotels_chain_idx ON hotels(chain_id);

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      hotel_id TEXT NOT NULL REFERENCES hotels(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS departments_hotel_idx ON departments(hotel_id);
    CREATE INDEX IF NOT EXISTS departments_tenant_idx ON departments(tenant_id);

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      hotel_id TEXT NOT NULL REFERENCES hotels(id),
      number TEXT NOT NULL,
      floor TEXT NOT NULL,
      room_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rooms_hotel_idx ON rooms(hotel_id);
    CREATE INDEX IF NOT EXISTS rooms_tenant_idx ON rooms(tenant_id);
    CREATE INDEX IF NOT EXISTS rooms_hotel_status_idx ON rooms(hotel_id, status);

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      hotel_id TEXT NOT NULL REFERENCES hotels(id),
      room_id TEXT NOT NULL REFERENCES rooms(id),
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bookings_hotel_idx ON bookings(hotel_id);
    CREATE INDEX IF NOT EXISTS bookings_tenant_idx ON bookings(tenant_id);
    CREATE INDEX IF NOT EXISTS bookings_room_idx ON bookings(room_id);
    CREATE INDEX IF NOT EXISTS bookings_hotel_status_idx ON bookings(hotel_id, status);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      chain_id TEXT REFERENCES hotel_chains(id),
      hotel_id TEXT REFERENCES hotels(id),
      department_id TEXT REFERENCES departments(id),
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      roles_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_tenant_email_idx ON users(tenant_id, email);
    CREATE INDEX IF NOT EXISTS users_hotel_idx ON users(hotel_id);

    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_sessions_user_idx ON refresh_sessions(user_id);
    CREATE INDEX IF NOT EXISTS refresh_sessions_tenant_idx ON refresh_sessions(tenant_id);

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      hotel_id TEXT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      correlation_id TEXT,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_events_tenant_created_idx
      ON audit_events(tenant_id, created_at);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name_he TEXT NOT NULL,
      name_en TEXT NOT NULL,
      domain TEXT NOT NULL,
      summary_he TEXT NOT NULL,
      autonomy_mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS briefing_rooms (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      chain_id TEXT NOT NULL REFERENCES hotel_chains(id),
      title TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status TEXT NOT NULL,
      host_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS briefing_rooms_tenant_idx ON briefing_rooms(tenant_id);
    CREATE INDEX IF NOT EXISTS briefing_rooms_chain_idx ON briefing_rooms(chain_id);

    CREATE TABLE IF NOT EXISTS briefing_participants (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES briefing_rooms(id),
      display_name TEXT NOT NULL,
      role_label TEXT NOT NULL,
      user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS briefing_participants_room_idx ON briefing_participants(room_id);

    CREATE TABLE IF NOT EXISTS briefing_shared_agents (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES briefing_rooms(id),
      agent_id TEXT NOT NULL REFERENCES agents(id),
      shared_by_user_id TEXT NOT NULL REFERENCES users(id),
      shared_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS briefing_shared_agents_room_idx ON briefing_shared_agents(room_id);
    CREATE UNIQUE INDEX IF NOT EXISTS briefing_shared_agents_room_agent_uidx
      ON briefing_shared_agents(room_id, agent_id);

    CREATE TABLE IF NOT EXISTS briefing_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES briefing_rooms(id),
      speaker_kind TEXT NOT NULL,
      speaker_id TEXT NOT NULL,
      speaker_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS briefing_messages_room_idx ON briefing_messages(room_id);

    CREATE TABLE IF NOT EXISTS briefing_recordings (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      chain_id TEXT NOT NULL REFERENCES hotel_chains(id),
      room_id TEXT NOT NULL REFERENCES briefing_rooms(id),
      status TEXT NOT NULL,
      started_by_user_id TEXT NOT NULL REFERENCES users(id),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      storage_key TEXT,
      mime_type TEXT,
      byte_size TEXT,
      duration_seconds TEXT,
      transcript_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS briefing_recordings_tenant_idx ON briefing_recordings(tenant_id);
    CREATE INDEX IF NOT EXISTS briefing_recordings_chain_idx ON briefing_recordings(chain_id);
    CREATE INDEX IF NOT EXISTS briefing_recordings_room_idx ON briefing_recordings(room_id);
    CREATE INDEX IF NOT EXISTS briefing_recordings_tenant_room_idx
      ON briefing_recordings(tenant_id, room_id);

    CREATE TABLE IF NOT EXISTS employee_profiles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT REFERENCES users(id),
      display_name TEXT NOT NULL,
      role_label TEXT NOT NULL,
      preferred_locale TEXT NOT NULL,
      hotel_id TEXT REFERENCES hotels(id),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS employee_profiles_tenant_idx ON employee_profiles(tenant_id);

    CREATE TABLE IF NOT EXISTS staff_chat_messages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      channel TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_user_id TEXT REFERENCES users(id),
      source_locale TEXT NOT NULL,
      source_body TEXT NOT NULL,
      translations_json TEXT NOT NULL,
      verification TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS staff_chat_messages_tenant_idx ON staff_chat_messages(tenant_id);
    CREATE INDEX IF NOT EXISTS staff_chat_messages_channel_idx ON staff_chat_messages(channel);

    CREATE TABLE IF NOT EXISTS ledger_accounts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      currency TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ledger_accounts_tenant_idx ON ledger_accounts(tenant_id);

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      account_id TEXT NOT NULL REFERENCES ledger_accounts(id),
      memo TEXT NOT NULL,
      debit INTEGER NOT NULL,
      credit INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      source_system TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS journal_entries_tenant_idx ON journal_entries(tenant_id);
    CREATE INDEX IF NOT EXISTS journal_entries_account_idx ON journal_entries(account_id);

    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      trigger_key TEXT NOT NULL,
      action_key TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      last_run_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS automations_tenant_idx ON automations(tenant_id);

    CREATE TABLE IF NOT EXISTS automation_runs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      automation_id TEXT NOT NULL REFERENCES automations(id),
      status TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS automation_runs_tenant_idx ON automation_runs(tenant_id);

    CREATE TABLE IF NOT EXISTS cookie_consents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT REFERENCES tenants(id),
      subject_key TEXT NOT NULL,
      necessary TEXT NOT NULL,
      functional TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cookie_consents_subject_idx ON cookie_consents(subject_key);

    CREATE TABLE IF NOT EXISTS payment_intents (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      hotel_id TEXT REFERENCES hotels(id),
      amount_minor TEXT NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT NOT NULL,
      payer_email TEXT,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS payment_intents_tenant_idx ON payment_intents(tenant_id);
    CREATE INDEX IF NOT EXISTS payment_intents_hotel_idx ON payment_intents(hotel_id);

    CREATE TABLE IF NOT EXISTS digital_signatures (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      signer_name TEXT NOT NULL,
      signer_user_id TEXT REFERENCES users(id),
      purpose TEXT NOT NULL,
      image_data_url TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS digital_signatures_tenant_idx ON digital_signatures(tenant_id);
    CREATE INDEX IF NOT EXISTS digital_signatures_subject_idx
      ON digital_signatures(subject_type, subject_id);

    CREATE TABLE IF NOT EXISTS webauthn_credentials (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      credential_id TEXT NOT NULL,
      public_key_jwk_json TEXT NOT NULL,
      device_label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS webauthn_credentials_cred_uidx
      ON webauthn_credentials(credential_id);

    CREATE TABLE IF NOT EXISTS auth_challenges (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT REFERENCES users(id),
      purpose TEXT NOT NULL,
      challenge TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_challenges_challenge_idx ON auth_challenges(challenge);

    CREATE TABLE IF NOT EXISTS oauth_identities (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      provider_subject TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS oauth_identities_provider_subject_uidx
      ON oauth_identities(provider, provider_subject);

    CREATE TABLE IF NOT EXISTS voice_enrollments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      phrase TEXT NOT NULL,
      sample_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS voice_enrollments_user_idx ON voice_enrollments(user_id);

    CREATE TABLE IF NOT EXISTS attendance_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      hotel_id TEXT NOT NULL REFERENCES hotels(id),
      employee_id TEXT NOT NULL REFERENCES employee_profiles(id),
      user_id TEXT REFERENCES users(id),
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      latitude TEXT,
      longitude TEXT,
      accuracy_meters TEXT,
      device_label TEXT NOT NULL,
      signature_id TEXT,
      voice_verified TEXT NOT NULL,
      webauthn_verified TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS attendance_events_tenant_idx ON attendance_events(tenant_id);
    CREATE INDEX IF NOT EXISTS attendance_events_employee_idx ON attendance_events(employee_id);
    CREATE INDEX IF NOT EXISTS attendance_events_hotel_idx ON attendance_events(hotel_id);
  `);
}
