# ADR 0001 — Monorepo Foundation

**Status:** Accepted  
**Date:** 2026-07-17

## Context

HotelOS AI requires multiple apps and shared packages under Clean Architecture and the approved Engineering Standard.

## Decision

- Use **pnpm workspaces** + **Turborepo**
- Shared TypeScript base with full strict flags (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, etc.)
- Package scope `@hotelos/*`
- First runnable surface: `apps/api` (Hono) with domain/application/presentation/infrastructure folders
- Foundational packages: `config`, `shared`, `validation`, `logger`, `auth` (tenancy model)

## Consequences

- Consistent tooling and type safety from day one
- Apps depend on built package `dist` outputs via workspace protocol
- Next ADRs will cover database choice, JWT implementation, and AI Gateway
