# Deploying to Vercel

HotelOS AI is a pnpm/turbo monorepo with four deployable units. Vercel deploys
one build output per project, so this ships as **four Vercel projects from
the same GitHub repo** (`executive`, `admin`, `guest`, `api`), each with its
own subdomain. A `vercel.json` is already committed in each app folder.

## 0. One-time: create a Turso database

The API used a local SQLite file (`better-sqlite3`) in dev. That doesn't work
on Vercel (no persistent disk), so it's been migrated to
[Turso](https://turso.tech) (hosted libSQL — same SQL dialect, same Drizzle
code, just reachable over the network). See ADR 0006 for the "why".

```bash
# https://docs.turso.tech/cli/installation
turso auth login
turso db create hotelos-prod
turso db show hotelos-prod --url        # -> libsql://hotelos-prod-xxx.turso.io
turso db tokens create hotelos-prod      # -> auth token
```

Keep both values — they become `DATABASE_URL` and `DATABASE_AUTH_TOKEN` on
the API project below. Local dev is untouched: `.env` still uses
`DATABASE_URL=file:.data/hotelos.sqlite` with no token.

## 1. Import the repo four times

In Vercel: **Add New → Project**, import the same Git repo four times. For
each one, set:

| Vercel project | Root Directory | Include files outside root directory |
|---|---|---|
| hotelos-api | `apps/api` | **On** |
| hotelos-executive | `apps/executive` | **On** |
| hotelos-admin | `apps/admin` | **On** |
| hotelos-guest | `apps/guest` | **On** |

"Include files outside the root directory" is required — it's what lets each
project's install/build commands `cd ../..` and build the shared
`packages/*` workspace dependencies (turbo's `dependsOn: ["^build"]` handles
the dependency order automatically). The `installCommand`/`buildCommand` in
each `vercel.json` already assume this.

## 2. API project env vars (`hotelos-api`)

| Variable | Value |
|---|---|
| `DATABASE_URL` | `libsql://hotelos-prod-xxx.turso.io` (from step 0) |
| `DATABASE_AUTH_TOKEN` | token from step 0 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | new random 32+ char secrets — **do not reuse the `.env` dev values** |
| `CORS_ORIGINS` | the three frontend URLs, comma-separated (fill in after step 3, then redeploy) |
| `NODEJS_HELPERS` | `0` (required — see `apps/api/api/index.ts`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | only if Google sign-in is enabled in prod |
| `WEBAUTHN_RP_ID` | your API's domain (WebAuthn ties credentials to a specific RP ID) |
| `RECORDINGS_PATH` | see the limitation below — leave default, recordings just won't persist yet |

Deploy this project first; note its URL (e.g. `https://hotelos-api.vercel.app`).

## 3. Frontend project env vars (`executive`, `admin`, `guest`)

Each of the three needs the API URL from step 2, plus the URLs of the other
two apps (for cross-app deep links, e.g. Admin → Executive):

| Variable | Value |
|---|---|
| `VITE_API_BASE` | `https://hotelos-api.vercel.app` |
| `VITE_APP_URL_EXECUTIVE` | `https://hotelos-executive.vercel.app` |
| `VITE_APP_URL_ADMIN` | `https://hotelos-admin.vercel.app` |
| `VITE_APP_URL_GUEST` | `https://hotelos-guest.vercel.app` |

Set the same three `VITE_APP_URL_*` values on all three frontend projects.
Deploy all three, then go back to the API project and fill in `CORS_ORIGINS`
with the three resulting URLs and redeploy it.

## Known limitation: meeting recordings

`RECORDINGS_PATH` (HotelOS Meet recordings) still writes to local disk. That
works for `pnpm dev` / a traditional always-on server, but on Vercel it will
not persist between invocations — recordings will appear to save and then
disappear. This wasn't part of the DB migration; treat it as a follow-up
(move to Vercel Blob or S3 before relying on recordings in production).

## Local dev is unaffected

Nothing above changes `pnpm dev`. `.env` still points at the local sqlite
file, ports are unchanged, and `pnpm typecheck` / `pnpm build` run the same
way.
