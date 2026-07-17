# Security Guide — HotelOS AI

**Version:** 1.0 · **Status:** ✅ Approved (PO, 2026-07-18)  
**Standard:** [Vol. 8](../engineering-standard/08-security.md) · Target **ASVS Level 2** (SaaS)

## Controls in place

- JWT access + refresh; logout revoke
- Tenant isolation on repositories
- Security headers middleware
- Rate limiting (`rate-limit.ts`)
- Cookie consent + legal docs
- WebAuthn / Google OAuth (config-gated)
- Audit events on critical writes
- Agent least privilege (catalog autonomy modes)

## Secrets

Never commit `.env`. Use `.env.example`. Production: Turso token, JWT secrets, Google OAuth secrets in host secrets store.

## Reporting

Security issues: private channel to Security Lead; do not open public GitHub issues with exploit detail.
