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

## Ops runbooks (stability)

| Doc | Purpose |
|---|---|
| [staging-production-checklist.md](./staging-production-checklist.md) | Staging vs prod gates before go-live |
| [turso-backup-restore.md](./turso-backup-restore.md) | DB backup / restore pointers |
| [uptime-monitoring.md](./uptime-monitoring.md) | Better Stack / UptimeRobot on `/v1/health` |
| [vms-pilot-runbook.md](./vms-pilot-runbook.md) | VMS webhook pilot + תיקון 13 checklist |

Generate recommended secrets locally (prints only; no `.env` write unless `--write`):

```bash
pnpm generate:ops-secrets
```

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
| `SENTRY_INGEST_SECRET` | **recommended in prod** — shared secret for `POST /v1/public/sentry/ingest` (Sentry webhooks → IT tasks; no JWT). Empty disables public ingest in production. |
| `SENTRY_DEFAULT_HOTEL_ID` | optional — fallback hotel UUID when Sentry events lack a `hotelId` tag (prefer tagging in SDK; see Error monitoring below) |
| `PMS_PROVIDER` | optional — `demo` (default), `mews_stub`, `opera_stub`, `protel_stub`, `fidelio_stub`, `clock_stub`, or `mews` (live) — HotelOS sits **above** the PMS |
| `MEWS_CLIENT_TOKEN` / `MEWS_ACCESS_TOKEN` | required when `PMS_PROVIDER=mews` |
| `MEWS_PLATFORM_URL` | optional — default `https://api.mews-demo.com` (prod: `https://api.mews.com`) |
| `PMS_INBOUND_SECRET` | optional — protects `POST /v1/public/pms/inbound` (channel manager → HotelOS) |
| `PAYMENT_PROVIDER` | optional — `demo` (default), `stripe_stub`, or `external` HTTP gateway (no PAN in HotelOS) |
| `PAYMENT_EXTERNAL_URL` / `PAYMENT_EXTERNAL_TOKEN` | required when `PAYMENT_PROVIDER=external` |
| `WHATSAPP_PROVIDER` | optional — `demo` (default), `http`, `meta`, or `off` |
| `WHATSAPP_API_TOKEN` / `WHATSAPP_META_PHONE_NUMBER_ID` | required for `meta`; token + URL for `http` |
| `DIGEST_WHATSAPP_TO` | optional — phone number (E.164 or Israeli local) that also receives the scheduled CIO daily digest over WhatsApp; empty = in-app inbox only |
| `SECURITY_INGEST_SECRET` | **recommended in prod** — shared secret for `POST /v1/public/security/ingest/:provider` (VMS webhooks; no JWT). Empty disables public ingest in production. |
| `REPUTATION_INGEST_SECRET` | **recommended in prod** — shared secret for `POST /v1/public/reputation/ingest/:provider` (OTA review webhooks; no JWT). Empty disables public ingest in production. |
| `PMS_INBOUND_SECRET` | optional — protects channel-manager inbound |

**Local preflight (no secret values printed):**

```bash
node scripts/check-vercel-api-ready.mjs
# or: node scripts/check-vercel-api-ready.mjs --env=apps/api/.env
```

See also [vms-pilot-runbook.md](./vms-pilot-runbook.md).

Deploy this project first; note its URL (e.g. `https://hotelos-api.vercel.app`).

### Rate limits / duplicate Git projects (Hobby plan)

Vercel Hobby can return **Deployment rate limited — retry in 24 hours** when many
projects are connected to the same GitHub repo and fire on every `main` push
(five `*-eight` apps + leftover projects like `hotel` / `hotel-os-ai-admin`).
Hobby also caps **serverless function execution** (duration + concurrent
invocations) more tightly than Pro — combined with a misconfigured
`NODEJS_HELPERS` this can look like double the real request volume, since
Vercel's Node helper wraps (and re-invokes) the request before Hono sees it.

Mitigations:

1. Keep only the five production projects linked to Git (`api`, `executive`,
   `admin`, `guest`, `work`). Disconnect or delete unused projects in the Vercel
   dashboard so they stop consuming the deploy quota.
2. Prefer `./scripts/deploy-five-vercel.ps1` (with `VERCEL_TOKEN`) for intentional
   releases instead of rapid consecutive pushes.
3. After a rate-limit window, redeploy API first (`hotel-os-ai-api-eight`), then
   the four frontends.
4. **Always set `NODEJS_HELPERS=0`** on the API project (see the env table
   above and `apps/api/api/index.ts`). Without it, Vercel's Node.js builder
   wraps the request/response before Hono sees it, which both breaks
   streaming/edge-style handling and inflates function invocation counts —
   worth checking first if Hobby's function quota is hit unexpectedly.
5. HotelOS's own `rate-limit.ts` (separate budget for `/v1/ai/*`) runs
   in-process and does **not** reduce Vercel's platform-level Hobby limits —
   the two are independent layers; both matter for capacity planning.

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

HotelOS uses the **Sentry SDK protocol** (Sentry SaaS or GlitchTip). Nothing is
sent until you paste real DSN values from your own Sentry org — never commit DSNs
to git.

### 1. Create projects and copy DSNs (Sentry dashboard)

1. Sign in at [sentry.io](https://sentry.io) (Developer free tier is enough for MVP).
2. Create one project per surface you want to monitor (recommended: **Node** for
   `apps/api`, **React** for each Vite app — or a single browser project shared
   across frontends).
3. For each project: **Settings → Client Keys (DSN)** — copy the DSN URL
   (`https://…@…ingest…sentry.io/…`). This is a *public* client key (safe in
   Vercel env vars, not in the repo).

### 2. Set DSN env vars on Vercel

| Surface | Vercel project | Variables |
|---|---|---|
| API | `hotel-os-ai-api-eight` | `SENTRY_DSN`, optional `SENTRY_ENVIRONMENT=production` |
| Admin / Executive / Guest / Work | each frontend project | `VITE_SENTRY_DSN`, optional `VITE_SENTRY_ENVIRONMENT=production` |

Redeploy after changing env vars. Empty DSN = SDK stays off (no network calls).

Optional: tag events with `hotelId` so Sentry webhooks route to the right hotel.
In browser SDK init (via `installBrowserSentry` options later) or Node:

```javascript
Sentry.setTag("hotelId", "<hotel-uuid>");
```

If all prod errors belong to one pilot hotel, set `SENTRY_DEFAULT_HOTEL_ID` on the
API project instead.

### 3. SDK behaviour (already in code)

- **API:** `@sentry/node` in `observability.ts` — unhandled Hono errors captured
  when `SENTRY_DSN` is set.
- **Vite apps:** `@sentry/browser` via `installBrowserSentry` in each app's
  `main.tsx` when `VITE_SENTRY_DSN` is set.
- **In-app inbox (authenticated):** clients report uncaught browser errors to
  `POST /v1/ops/error-events` → **IT** department task (works without Sentry).

### 4. Sentry webhook → IT department tasks

Wire Sentry alerts back into HotelOS (same `department_tasks` / IT inbox as above):

1. Generate a random `SENTRY_INGEST_SECRET` (≥16 chars) and set it on the **API**
   Vercel project (see env table above).
2. In Sentry: **Settings → Integrations → Create New Integration → Internal
   Integration** (or use an Issue Alert webhook action).
3. Webhook URL:

   `https://<your-api-host>/v1/public/sentry/ingest`

4. HTTP header: `Authorization: Bearer <SENTRY_INGEST_SECRET>`  
   (alternative header: `X-HotelOS-Sentry-Secret: <same secret>`).
5. Enable **Issue** webhooks (`created`) and/or attach the integration to an
   **Issue Alert** rule (`triggered`). Resolved/assigned events are ignored.
6. Ensure events include `hotelId` (SDK tag) or set `SENTRY_DEFAULT_HOTEL_ID` on
   the API.

Test with a deliberate error after DSN is set; confirm an IT task appears in Admin
→ Operations → IT (or via `GET /v1/ops/departments/it/tasks?hotelId=…`).

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
