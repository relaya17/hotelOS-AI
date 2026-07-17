# ADR 0004 — Turbo OS: automations, i18n, accounting, voice, mobile

**Status:** Accepted  
**Date:** 2026-07-17

## Context

HotelOS must operate as a turbo OS across chain and property surfaces: automations everywhere they matter, phone-ready apps, advanced accounting (internal or external ERP), voice-driven agents, and verified multilingual delivery so staff instructions authored once are received in each employee’s language.

## Decision

1. Ship `@hotelos/i18n` with curated UI dictionaries and chat phrase bank for: he, en, ar, ru, es, th, zh, hi, tr, el (RTL where required). Chat translations carry `verified` | `provisional`.
2. Expose Turbo modules under Executive (chain level): Accounting, Staff chat, Automations, Voice agent — alongside portfolio + briefing rooms.
3. Persist automations, ledger, employee preferred locales, and staff chat via `/v1/turbo/*`.
4. Make all three frontends installable as PWAs with responsive shells.

## Consequences

- Voice uses browser Speech Recognition when available; typed intents remain first-class.
- Accounting can run on `hotelos.internal` or sync markers for `external.erp.connector`.
- Unverified free-text chat shows provisional badges until curated.
