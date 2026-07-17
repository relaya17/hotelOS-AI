# ADR 0003 — Three separate apps with distinct URLs

**Status:** Accepted  
**Date:** 2026-07-17

## Context

A hotel chain has multiple hotels. Mixing chain oversight with hotel operations and guest journeys in one SPA weakens UX and deployment boundaries.

## Decision

Ship three separate frontends with separate local addresses:

| App | Port | Level |
|-----|------|--------|
| `executive` | 5173 | Chain / multi-hotel control tower |
| `admin` | 5174 | Single-hotel operations |
| `guest` | 5175 | Guest stay experience |

Shared API remains one service (`apps/api`). CORS allows all three origins.

## Consequences

- Executive dashboard stays high-level (KPIs per hotel, deep-link to Admin).
- Admin focuses on rooms/bookings for one selected hotel.
- Guest never shares UI shell with staff apps.
