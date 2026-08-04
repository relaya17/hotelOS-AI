# Staging vs production checklist

HotelOS ships as **five Vercel projects** (see [vercel.md](./vercel.md)). Use this
checklist before treating an environment as production-ready.

## Environment split

| Item | Staging | Production |
|---|---|---|
| Turso database | Separate DB (e.g. `hotelos-staging`) | `hotelos-prod` (or equivalent) |
| Vercel projects | Same naming suffix or `-staging` suffix | `hotel-os-ai-*-eight` (or your chosen suffix) |
| JWT secrets | Unique random values | **Never reuse staging or dev secrets** |
| `ALLOW_DEMO_AUTH` / `ALLOW_DEMO_SEED` | May be `true` for QA | **Must be off** (unset or `false`) |
| `SECURITY_INGEST_SECRET` | Test value OK | Required before VMS webhooks go live |
| `CRON_SECRET` | Optional | Required for scheduled digests / anomaly scan |
| `SENTRY_DSN` | Optional staging project | Production DSN + `SENTRY_ENVIRONMENT=production` |
| Google OAuth / WebAuthn | Staging redirect URIs + RP ID | Production domains only |

## Pre-deploy (both environments)

```bash
pnpm qa                                    # typecheck, lint, test, build
pnpm check:vercel-api                      # Turso + required API env (no secret dump)
node scripts/generate-ops-secrets.mjs      # optional: print CRON / VMS secrets
```

Sync env vars to the Vercel **API** project first, then the four frontends
(`HOTELOS_API_ORIGIN`).

## Production-only gates

- [ ] `NODEJS_HELPERS=0` on API (see [vercel.md § Rate limits](./vercel.md#rate-limits--duplicate-git-projects-hobby-plan))
- [ ] `CORS_ORIGINS` includes production frontend URLs (or `https://*.vercel.app`)
- [ ] No `file:` `DATABASE_URL` on Vercel
- [ ] Cron jobs enabled in `apps/api/vercel.json` with matching `CRON_SECRET`
- [ ] [Uptime monitor](./uptime-monitoring.md) on `/v1/health`
- [ ] [Turso backup policy](./turso-backup-restore.md) documented and tested once
- [ ] VMS pilot: [vms-pilot-runbook.md](./vms-pilot-runbook.md) + counsel sign-off

## Staging smoke (after deploy)

1. `GET https://<api>/v1/health` → `{ "status": "ok", … }`
2. Login on Admin + Executive (no `localhost` in browser network tab)
3. One cron path: `curl -H "Authorization: Bearer $CRON_SECRET" https://<api>/v1/cron/anomaly-scan` → not 503
4. Optional: `pnpm ping:turso` from a machine with staging `.env`

## Trust / RAG honesty (staging + prod copy)

Before go-live marketing or www deploy, confirm public claims match shipped surfaces:

| Check | Expected |
|-------|----------|
| www `#trust` | Live controls only — **no** SOC 2 / ISO / HotelOS PCI-DSS claims |
| Payments UI | Mode from `GET /v1/public/payments/status` (`demo` / `stripe_stub` / `external`); no HotelOS PCI badge |
| Knowledge / RAG | Hybrid keyword + optional embeddings — **not** “full Vector RAG” |
| Trusted fetch | **Not live** (CFO market snapshot ingest ≠ general page fetch→embed) |
| DPA | Public page is an **unsigned template** until counsel signs per customer |

Source of truth: [trust-center-mvp.md](../planning/trust-center-mvp.md) · [rag-embeddings-mvp.md](../planning/rag-embeddings-mvp.md) · [gtm-outcomes-pitch.md](../planning/gtm-outcomes-pitch.md) (Readiness board).

## Hobby plan note

If Vercel returns **Deployment rate limited — retry in 24 hours**, do not retry
deploys in a loop. Disconnect duplicate Git-linked projects, wait for the window,
then deploy **API first**, then frontends. Details in [vercel.md](./vercel.md).
