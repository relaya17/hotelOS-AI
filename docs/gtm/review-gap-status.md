# Review gap closeout — status after engineering wave

Last update: 2026-08-05 · code on `main`.

## Closed in code/CI

| Review finding | Status |
|----------------|--------|
| Lead form mailto-only | **Fixed** — `POST /v1/leads` + DB + success/error UI + Playwright |
| Giant `api-client.ts` | **Split** — `packages/web-client/src/api/*` |
| Giant API route files | **Split** — ops/public/autonomy/briefing/trust facades |
| Giant www landing | **Split** — `apps/www/src/landing/` |
| JSON-LD currency drift | **CI** — `pnpm check:www-jsonld` |
| Near-zero front tests | **Partial** — www content/nav + web-client smoke (login/HITL/lead/HR) |
| Axe only login + public | **Expanded** — secured stubs: approvals, HR, ops dashboard, portfolio, work attendance |
| Orphan nav sections | **Restored** — `#how-pilot` `#measure` `#excellence` `#faq` |
| Locale HE-only vs USD | **Documented** — `locale-strategy.md` (intentional) |
| GTM meta checklist | **Added** — `landing-gtm-checklist.md` |

## Still human / business (not code)

See [business-fill.md](./business-fill.md): Calendly URL, demo video, **pilot@ monitoring**, design partner, SOC2 Phase 0 sponsor, sales practice.

## Optional next engineering (not blocking)

- More axe panels (maintenance, twin) if churn increases there
- Admin React component tests (beyond API-client smoke) once a test runner is chosen
- Alert/webhook when `marketing_leads` inserts (ops)
