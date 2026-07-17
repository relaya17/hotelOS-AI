# ADR 0005 — Trust stack: legal, payments, biometrics, Google staff auth, attendance

**Status:** Accepted  
**Date:** 2026-07-17

## Context

HotelOS must ship enterprise trust surfaces: terms/cookies/security/privacy, internal payments with digital signatures, WebAuthn (fingerprint/face) and voice verification, Google staff sign-in, and per-employee phone clock-in/out with geo tracking — without weakening tenant isolation or TypeScript strictness.

## Decision

1. Publish versioned legal documents via `@hotelos/legal` and `GET /v1/public/legal`.
2. Persist trust artifacts in dedicated SQLite tables (consents, payment intents, signatures, WebAuthn, OAuth links, voice enrollments, attendance events).
3. Expose authenticated `/v1/trust/*` for payments, signatures, WebAuthn, voice, attendance; public cookie consent + Google OAuth start/demo.
4. Surface attendance on Executive and Admin (mobile-first clock with optional geo, signature, voice). Guest app hosts legal document viewer + cookie banner.
5. Google: real OAuth when `GOOGLE_CLIENT_ID` is set (`/start` + `/callback` → post-login redirect with session fragment); otherwise staff demo endpoint for an existing tenant user.
6. Auth session lifecycle: client auto-refresh on 401; `POST /v1/auth/logout` revokes refresh sessions.
7. WebAuthn: register on Trust page; login via assert; attendance clock can attach assert proof.
8. Apply security headers on all API responses.

## Consequences

- Attendance tracking is first-class: each clock event is tenant-scoped, audited, and may carry geo + voice + WebAuthn flags.
- Google/WebAuthn must never create users implicitly — only link/login existing staff.
- Payment provider adapters remain configuration-gated (internal intents for now).
