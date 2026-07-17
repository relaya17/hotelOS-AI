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
5. Google: real OAuth when `GOOGLE_CLIENT_ID` is set; otherwise staff demo endpoint that issues a normal session for an existing tenant user.
6. Apply security headers on all API responses.

## Consequences

- Attendance tracking is desirable and first-class: each clock event is tenant-scoped, audited, and may carry geo + voice + WebAuthn flags.
- Demo Google login must never create users implicitly — only link/login existing seeded staff.
- Production Google callback and payment provider adapters remain configuration-gated.
