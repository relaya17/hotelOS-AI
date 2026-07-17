# ADR 0002 — SQLite for local Foundation

**Status:** Accepted  
**Date:** 2026-07-17

## Context

We need a real persistence layer for tenancy and auth without blocking on cloud Postgres provisioning.

## Decision

- Use **Drizzle ORM** + **better-sqlite3** for local/dev Foundation.
- Keep repository interfaces in application/domain-friendly shapes so Postgres can replace the driver later per logical DB strategy (Volume 6).
- File location: `.data/hotelos.sqlite` (gitignored).

## Consequences

- Fast local onboarding and deterministic tests.
- Production target remains managed Postgres (future ADR).
