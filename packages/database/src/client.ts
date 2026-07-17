import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema/tenancy.js";

export type HotelOsSchema = typeof schema;
export type HotelOsDb = BetterSQLite3Database<HotelOsSchema>;

export type DbHandle = {
  readonly db: HotelOsDb;
  readonly close: () => void;
};

export function createDb(sqlitePath: string): DbHandle {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const sqlite = new Database(sqlitePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(sqlite);
  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}

function migrate(sqlite: Database.Database): void {
  sqlite.exec(`
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
  `);
}
