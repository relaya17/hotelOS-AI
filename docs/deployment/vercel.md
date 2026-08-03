# Deploying to Vercel

HotelOS AI is a pnpm/turbo monorepo with five deployable units. Vercel deploys
one build output per project, so this ships as **five Vercel projects from
the same GitHub repo** (`executive`, `admin`, `guest`, `work`, `api`), each with
its own subdomain. A `vercel.json` is already committed in each app folder.

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

## 0b. Root architecture (read first)

See **[four-projects.md](./four-projects.md)**. Frontends use **same-origin**
`/v1/*` + Edge `middleware.ts` → separate API. Browser never calls `localhost`.

## 1. Import the repo **five** times (recommended)

Four separate frontends **plus a separate API** is the correct production
shape (ADR 0003): Guest / Admin (hotel) / Executive (management) / Work
(employees) / API. Or run `./scripts/deploy-five-vercel.ps1`.

In Vercel: **Add New → Project**, import the same Git repo five times. Name
them with a shared prefix so sibling URLs auto-resolve, e.g.:

| Vercel project name (example) | Root Directory | Role |
|---|---|---|
| `hotel-os-ai-api-eight` | `apps/api` | API server |
| `hotel-os-ai-executive-eight` | `apps/executive` | הנהלת רשת (hq) |
| `hotel-os-ai-admin-eight` | `apps/admin` | תפעול מלון (ops) |
| `hotel-os-ai-guest-eight` | `apps/guest` | אורחים (book) |
| `hotel-os-ai-work-eight` | `apps/work` | עובדים (work) |

For each project: **Include files outside the root directory = On**.

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
| `CORS_ORIGINS` | `https://*.vercel.app` (or the three exact frontend URLs). Production also auto-appends the Vercel wildcard if missing. |
| `NODEJS_HELPERS` | `0` (required — see `apps/api/api/index.ts`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | only if Google sign-in is enabled in prod |
| `WEBAUTHN_RP_ID` | your API's domain (WebAuthn ties credentials to a specific RP ID) |
| `RECORDINGS_PATH` | local/dev path only; on Vercel prefer Blob (below) |
| `BLOB_READ_WRITE_TOKEN` | optional — Vercel Blob read/write token; when set, Meet recordings persist via Blob instead of ephemeral disk |
| `CRON_SECRET` | optional — enables `GET/POST /v1/cron/*` (Vercel Cron sends `Authorization: Bearer …`) |
| `SENTRY_DSN` | optional — Sentry/GlitchTip DSN for API server errors |
| `SENTRY_ENVIRONMENT` | optional — defaults to `NODE_ENV` |
| `PMS_PROVIDER` | optional — `demo` (default), `mews_stub`, `opera_stub`, or `mews` for live Mews Connector API |
| `MEWS_CLIENT_TOKEN` / `MEWS_ACCESS_TOKEN` | required when `PMS_PROVIDER=mews` |
| `MEWS_PLATFORM_URL` | optional — default `https://api.mews-demo.com` (prod: `https://api.mews.com`) |
| `WHATSAPP_PROVIDER` | optional — `demo` (default), `http`, `meta`, or `off` |
| `WHATSAPP_API_TOKEN` / `WHATSAPP_META_PHONE_NUMBER_ID` | required for `meta`; token + URL for `http` |

Deploy this project first; note its URL (e.g. `https://hotelos-api.vercel.app`).

## 3. Frontend project env vars (`executive`, `admin`, `guest`, `work`)

Each frontend needs the API URL from step 2 (or naming-convention inference),
plus sibling app URLs for cross-app deep links (e.g. Admin → Work invites):

| Variable | Value |
|---|---|
| `VITE_API_BASE` | `https://hotel-os-ai-api-eight.vercel.app` (your API project URL) — optional when Edge middleware + naming convention are used |
| `HOTELOS_API_ORIGIN` | API URL for Edge `middleware.ts` proxy (recommended) |
| `VITE_APP_URL_EXECUTIVE` | executive URL (optional if names follow `…-executive-…` convention) |
| `VITE_APP_URL_ADMIN` | admin URL (optional with `…-admin-…` naming) |
| `VITE_APP_URL_GUEST` | guest URL (optional with `…-guest-…` naming) |
| `VITE_APP_URL_WORK` | work URL (optional with `…-work-…` naming) |
| `VITE_SENTRY_DSN` | optional — browser Sentry/GlitchTip DSN (empty = disabled) |
| `VITE_SENTRY_ENVIRONMENT` | optional — defaults to Vite `MODE` |

**Naming convention:** if frontends are `…-admin-…` / `…-executive-…` /
`…-guest-…` / `…-work-…` and API is `…-api-…` on the same suffix, the client
**infers** sibling URLs even when `VITE_API_BASE` was baked as localhost —
still set `HOTELOS_API_ORIGIN` (or `VITE_API_BASE`) explicitly and redeploy
for production clarity.

Emergency override without rebuild: open  
`https://hotel-os-ai-admin-eight.vercel.app/?api=https://hotel-os-ai-api-eight.vercel.app`

## Meeting recordings storage

- **Local / always-on server:** `RECORDINGS_PATH` writes to disk (default).
- **Vercel:** set `BLOB_READ_WRITE_TOKEN` (Vercel Blob store) so the API uses
  object storage. Without the token, uploads hit ephemeral disk and will not
  survive between invocations.

## Scheduled CIO daily digest

`apps/api/vercel.json` defines:

- daily `0 5 * * *` UTC → `/v1/cron/cio-daily` (CEO digest → org-comms `cio_daily`)
- daily `15 5 * * *` UTC → `/v1/cron/cfo-daily` (Finance Doctor: Trusted market refresh → agent.cfo brief → org-comms `cfo_daily`)
- every 6 hours `30 */6 * * *` UTC → `/v1/cron/anomaly-scan` (threshold anomalies → department tasks)
- every 10 minutes `*/10 * * * *` UTC → `/v1/cron/notification-outbox` (retry pending/failed WhatsApp)

WhatsApp live delivery — pick one:

| `WHATSAPP_PROVIDER` | Required env | Notes |
|---------------------|--------------|--------|
| `demo` | — | Local/CI; marks invites as sent |
| `http` | `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN` | Generic gateway: `POST` `{ "to", "body" }` + Bearer (any 2xx) |
| `meta` | `WHATSAPP_API_TOKEN`, `WHATSAPP_META_PHONE_NUMBER_ID` | Meta Cloud API; optional `WHATSAPP_META_TEMPLATE_NAME` (`{{1}}`=guest, `{{2}}`=room) for cold invites |
| `off` | — | Skip delivery |

Set matching `CRON_SECRET` in the API project env. Without it, cron endpoints return 503.

## Error monitoring

- **API:** set `SENTRY_DSN` (Sentry SaaS or GlitchTip). Unhandled Hono errors are
  captured; without a DSN the SDK stays off.
- **Vite apps (admin / executive / guest):** set `VITE_SENTRY_DSN` (and optional
  `VITE_SENTRY_ENVIRONMENT`) on each frontend Vercel project. Empty DSN = SDK off.
- **In-app inbox:** authenticated clients report uncaught browser errors to
  `POST /v1/ops/error-events`, which creates an **IT** department task (same
  pattern as security webhooks).

## Local dev is unaffected

Nothing above changes `pnpm dev`. `.env` still points at the local sqlite
file, ports are unchanged, and `pnpm typecheck` / `pnpm build` run the same
way.

## Troubleshooting: CORS / `localhost:3001` from Vercel

If the browser console shows something like:

```text
Access to fetch at 'http://localhost:3001/v1/auth/login' from origin
'https://hotel-os-ai-admin-eight.vercel.app' has been blocked by CORS
```

the Admin (or Executive/Guest) build still has the **dev default** API URL.
A Vercel site cannot use your laptop’s `localhost:3001`.

**Fix (required):**

1. Find the API project URL (e.g. `https://hotel-os-ai-api-….vercel.app`).
2. On **each** frontend Vercel project (`admin` / `executive` / `guest` / `work`):
   - Settings → Environment Variables
   - `HOTELOS_API_ORIGIN` = `https://<your-api>.vercel.app` (no trailing slash)
   - optional: `VITE_API_BASE` = same API URL
   - Redeploy (Vite bakes `VITE_*` at **build** time — changing env without redeploy does nothing)
3. On the **API** Vercel project:
   - `CORS_ORIGINS` = `https://*.vercel.app` (or the four exact frontend URLs)
   - Redeploy API

Until step 2 is done, login may keep targeting `localhost` and look like a CORS error.
