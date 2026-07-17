# Architecture Decision Records — Index

ADRs document material architecture decisions per [Engineering Standard Vol. 2 §2.15](../engineering-standard/02-software-engineering.md) / [Vol. 13 §13.2](../engineering-standard/13-documentation.md). Template: **Context · Decision · Consequences · Status · Alternatives**.

| # | Title | Status | Date | Summary |
|---|-------|--------|------|---------|
| [0001](0001-monorepo-foundation.md) | Monorepo Foundation | Accepted | 2026-07-17 | pnpm workspaces + Turborepo, `@hotelos/*` scope, strict TS base, `apps/api` (Hono) as first runnable surface |
| [0002](0002-local-sqlite-foundation.md) | SQLite for local Foundation | Superseded by [0006](0006-libsql-turso-hosted-db.md) | 2026-07-17 | Drizzle ORM + better-sqlite3 for local/dev persistence before cloud DB was provisioned |
| [0003](0003-three-separate-apps.md) | Three separate apps with distinct URLs | Accepted | 2026-07-17 | Separate `executive` / `admin` / `guest` frontends over one shared `apps/api`; Executive also hosts chain-level Briefing Rooms |
| [0004](0004-turbo-os-i18n-automations.md) | Turbo OS: automations, i18n, accounting, voice, mobile | Accepted | 2026-07-17 | `@hotelos/i18n` (10 languages), Turbo modules (Accounting, Staff chat, Automations, Voice agent) under Executive, PWA shells |
| [0005](0005-trust-compliance-attendance.md) | Trust stack: legal, payments, biometrics, Google staff auth, attendance | Accepted | 2026-07-17 | Versioned legal docs, `/v1/trust/*` (payments, signatures, WebAuthn, voice, attendance), Google OAuth for staff, security headers |
| [0006](0006-libsql-turso-hosted-db.md) | libSQL/Turso as the hosted database driver | Accepted | 2026-07-17 | Replace `better-sqlite3` with `@libsql/client` for Vercel-compatible hosted DB; `DATABASE_URL`/`DATABASE_AUTH_TOKEN` |
| [0007](0007-cio-orchestrator-kashrut-org-comms.md) | CIO orchestrator, Trusted knowledge, Kashrut supervisor, org comms | Accepted | 2026-07-18 | `agent.cio` front-door orchestrator, Trusted-knowledge-only external facts, `agent.kashrut` always-on advisory seat, Org Comms graph |

## Adding a new ADR

1. Copy the template (Context · Decision · Consequences · Status · Alternatives) into `docs/adr/NNNN-short-title.md` (next sequential number, zero-padded to 4 digits).
2. Add a row to the table above.
3. Link the ADR from the Engineering Standard volume(s) it affects, if any.
