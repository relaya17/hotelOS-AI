# ADR 0006 — libSQL/Turso as the hosted database driver

**Status:** Accepted
**Date:** 2026-07-17

## Context

ADR 0002 chose better-sqlite3 for local Foundation work. That driver needs a
writable local disk and a native binary per platform, neither of which exists
on Vercel's serverless Functions (ephemeral, read-only filesystem outside
`/tmp`, and `/tmp` doesn't survive between invocations). Deploying the API to
Vercel therefore required a driver swap, not just a hosting change.

## Decision

- Replace `better-sqlite3` + `drizzle-orm/better-sqlite3` with
  `@libsql/client` + `drizzle-orm/libsql` in `packages/database`.
- `createDb()` now takes a `{ url, authToken }` pair instead of a bare file
  path. `url` can be:
  - `file:.data/hotelos.sqlite` — local dev, unchanged behavior, no server
    required.
  - `libsql://<db>.turso.io` — hosted Turso database, used in production.
- Config: `DATABASE_URL` replaces `DATABASE_PATH`; `DATABASE_AUTH_TOKEN` is
  new and only required for hosted URLs.
- Schema/query code (`drizzle-orm/sqlite-core`, all repositories) is
  unchanged — libSQL speaks the same SQL dialect and Drizzle API.

## Consequences

- Local dev workflow is unchanged (`pnpm dev` still writes to
  `.data/hotelos.sqlite`).
- Production (Vercel) needs a Turso account + database created out of band —
  see `docs/deployment/vercel.md`.
- `RECORDINGS_PATH` (meeting recording blobs) is a separate concern and is
  **not** covered by this ADR — it still assumes a writable local disk and
  will not persist across Vercel invocations. Tracked as a follow-up (needs
  object storage, e.g. Vercel Blob or S3).
