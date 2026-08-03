# Live Stream Threat Model — HotelOS AI

**Scope:** SSE/WebSocket ops event streams (planned `/v1/ops/stream` or similar).  
**Status:** Design review · complements [Vol. 8](../engineering-standard/08-security.md).

## Assets

- Real-time ops events (incidents, maintenance signals, approval state changes)
- JWT access tokens (tenant + hotel scope)
- Guest PII in enriched payloads (must not leak cross-tenant)

## Trust boundaries

| Actor | Trust |
|-------|-------|
| Authenticated staff (Executive/Admin) | JWT bearer, hotel ACL |
| Browser EventSource/fetch | Same-origin or CORS allow-list; **no token in URL** |
| Upstream connectors (PMS/VMS) | Webhook secrets; mapped to tenant/hotel server-side |

## Threats & mitigations

### 1. Token in query string (`?token=…`)

**Risk:** Tokens in URLs appear in logs, Referer headers, browser history, and proxy caches.

**Mitigation:** **Ban query-string auth.** Use `Authorization: Bearer` header only. For EventSource (no custom headers in native API), use short-lived stream ticket obtained via authenticated POST, or fetch-based SSE with `Authorization`. Never accept `?access_token=` on stream endpoints.

### 2. Cross-tenant data leak

**Risk:** Stream fan-out delivers another hotel's incidents.

**Mitigation:**

- `requireAuth` on connect handshake
- Resolve `hotelId` from path or validated subscription body
- `canAccessHotel(principal, hotelId)` before subscribing
- Repository queries scoped by `tenantId` from JWT principal

### 3. Stale or stolen JWT reconnect

**Risk:** Long-lived connection outlives token expiry; stolen token replays stream.

**Mitigation:**

- Verify JWT at connect; enforce access-token TTL (≤15 min typical)
- Periodic re-auth or connection close on expiry
- Refresh via standard `/v1/auth/refresh` then reconnect with new bearer
- Revoked tokens rejected at verify

### 4. Connection exhaustion (DoS)

**Risk:** Attacker opens many SSE/WebSocket connections.

**Mitigation:**

- Dedicated rate limit bucket: `STREAM_RATE_LIMIT_POLICY` (10/min per IP+tenant) in `rate-limit.ts`
- Max concurrent connections per user/tenant at app layer (when implemented)
- Idle timeout + heartbeat

### 5. Oversized or sensitive payloads

**Risk:** Stream carries full guest records, API keys, or unbounded event history.

**Mitigation:**

- Minimal event envelope: `{ type, id, hotelId, severity, title, at }` — no raw PII
- Redact approval payloads (see `redact-approval-payload.ts`) before any client exposure
- Cap backlog / replay window server-side

### 6. CORS misconfiguration

**Risk:** Arbitrary origins read stream with user token.

**Mitigation:**

- CORS allow-list via `isOriginAllowed` (existing `create-app.ts`)
- `Authorization` in `allowHeaders` — clients must send bearer, not cookies alone
- No `Access-Control-Allow-Origin: *` with credentials

## Current state (2026-08)

| Surface | Auth | Hotel ACL | Notes |
|---------|------|-----------|-------|
| `GET /v1/guests/by-email` | ✅ requireAuth | ✅ resolveHotelId | Guest 360 staff lookup |
| `GET /v1/integrations/catalog` | ✅ requireAuth | N/A (tenant metadata) | No secrets |
| `GET /v1/ai/approvals/*` | ✅ requireAuth | ✅ filterVisibleApprovals + decide gate | kashrut-gate ACL added |
| Live stream routes | Not deployed | Design above | Rate-limit policy pre-wired |

## Checklist before GA

- [ ] Stream route uses header auth only (integration test rejects `?token=`)
- [ ] Hotel ACL on subscribe
- [ ] Payload schema reviewed; PII fields excluded
- [ ] Load test: connection limit + rate limit under abuse
- [ ] Audit log on connect/disconnect for sensitive streams
