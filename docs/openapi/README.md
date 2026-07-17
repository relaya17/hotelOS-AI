# OpenAPI — HotelOS API surface

**Version:** 1.0  
**Status:** ✅ Approved inventory (PO, 2026-07-18)  
**Note:** Full OpenAPI YAML generation can be added in CI; this inventory is the contract checklist for v1.

Base: `http://localhost:3001`

## Public

| Method | Path |
|--------|------|
| GET | `/health` |
| GET | `/v1/meta/apps` |
| GET | `/v1/meta/tenancy-model` |
| GET | `/v1/public/legal` |
| POST | `/v1/public/stays/lookup` |
| POST | `/v1/public/stays/check-in` |
| POST | `/v1/public/feedback` (if enabled) |

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
| * | `/v1/ops/**` including `GET /v1/ops/cio-digest` |
| * | `/v1/org-comms/**` |
| * | `/v1/knowledge/**` |
| * | `/v1/kashrut/**` |

Auth: `Authorization: Bearer <accessToken>`. Rate limits apply (see `rate-limit.ts`).
