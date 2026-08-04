# OpenAPI — HotelOS API surface

**Version:** 1.0  
**Status:** ✅ Approved inventory + live OpenAPI 3.1 spec (2026-08-04)  
**Spec file:** [`hotelos-v1.openapi.yaml`](./hotelos-v1.openapi.yaml)  
**Live (running API):** `GET /v1/meta/openapi.yaml` · `GET /v1/meta/openapi.json`

Base: `http://localhost:3001`

Partners should prefer the live meta URLs or the YAML in this folder. Incomplete or evolving routes are marked in the spec with **see README inventory** below.

## Sync note

Source of truth: `docs/openapi/hotelos-v1.openapi.yaml`.  
The API serves a bundled copy from `apps/api/src/presentation/http/openapi-spec.embed.{json,yaml}` for Vercel/production; re-run embed sync after YAML changes:

```bash
node -e "const fs=require('fs');const yaml=require('yaml');const p='docs/openapi/hotelos-v1.openapi.yaml';const spec=yaml.parse(fs.readFileSync(p,'utf8'));fs.writeFileSync('apps/api/src/presentation/http/openapi-spec.embed.json',JSON.stringify(spec));fs.copyFileSync(p,'apps/api/src/presentation/http/openapi-spec.embed.yaml');"
```

## Public

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/v1/meta/apps` |
| GET | `/v1/meta/tenancy-model` |
| GET | `/v1/meta/openapi.yaml` |
| GET | `/v1/meta/openapi.json` |
| GET | `/v1/public/legal` |
| POST | `/v1/public/stays/lookup` |
| POST | `/v1/public/stays/check-in` |
| POST | `/v1/public/feedback` (if enabled) |
| POST | `/v1/leads` (www marketing contact) |

## Auth

| Method | Path |
|--------|------|
| POST | `/v1/auth/login` |
| POST | `/v1/auth/refresh` |
| POST | `/v1/auth/logout` |
| GET | `/v1/auth/me` |

## Hotels / overview

| Method | Path |
|--------|------|
| GET | `/v1/hotels` |
| PATCH | `/v1/hotels/:hotelId/kashrut` |
| GET | `/v1/hotels/:id/rooms` |
| PATCH | `/v1/hotels/:hotelId/rooms/:roomId/status` |
| GET/POST | `/v1/hotels/:id/bookings` |
| POST | `/v1/hotels/:hotelId/bookings/:bookingId/status` |
| GET | `/v1/overview/chain` |

## Guests / twin

| Method | Path |
|--------|------|
| GET | `/v1/guests/by-email?hotelId=&email=` |
| GET | `/v1/twin/hotels/:hotelId` |
| POST | `/v1/twin/hotels/:hotelId/pms-sync` |

## Streams (SSE)

| Method | Path |
|--------|------|
| GET | `/v1/streams/ops-dashboard?hotelId=` — Bearer only; events `snapshot`, `heartbeat`, `reconnect` |

Auth: `Authorization: Bearer <accessToken>`. Long-lived SSE paths under `/v1/streams/*` use a dedicated connection-open budget (see `STREAM_RATE_LIMIT_POLICY` in `rate-limit.ts`) — not the general 120/min bucket.

## Turbo / agents / briefings

| Method | Path |
|--------|------|
| GET | `/v1/agents` |
| * | `/v1/briefing-rooms/**` |
| * | `/v1/turbo/**` |

## Trust / ops / ADR 0007

| Method | Path |
|--------|------|
| * | `/v1/trust/**` |
| * | `/v1/ops/**` including `GET /v1/ops/forecast`, `GET /v1/ops/cio-digest` |
| * | `/v1/org-comms/**` |
| * | `/v1/knowledge/**` |
| * | `/v1/kashrut/**` |
| — | `/v1/ops/knowledge-graph` (planned — stub in OpenAPI) |

## Autonomy (HITL suggest)

| Method | Path |
|--------|------|
| POST | `/v1/autonomy/suggest` |
| POST | `/v1/autonomy/suggest-low-stock` |
| POST | `/v1/autonomy/suggest-dirty-rooms` |
| POST | `/v1/autonomy/suggest-send-purchase-order` |
| POST | `/v1/autonomy/suggest-recruiting-stage` |
| POST | `/v1/autonomy/suggest-todays-arrivals` |
| POST | `/v1/autonomy/suggest-feedback-followup` |
| POST | `/v1/autonomy/suggest-ledger-close` |

## Integrations

| Method | Path |
|--------|------|
| — | `/v1/integrations/catalog` (planned — domains in `@hotelos/connectors`) |

Auth: `Authorization: Bearer <accessToken>`. Rate limits apply (see `rate-limit.ts`).
