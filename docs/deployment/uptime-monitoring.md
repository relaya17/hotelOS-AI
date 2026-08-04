# External uptime monitoring

Use an external checker so you know the API is reachable **outside** Vercel's
dashboard. Failures can also feed IT tasks via Sentry or manual triage.

## Endpoint

| URL | Expected |
|---|---|
| `GET https://<api-host>/v1/health` | HTTP **200**, JSON `"status":"ok"` |
| `GET https://<api-host>/health` | Same (legacy alias) |

Production example:

```text
https://hotel-os-ai-api-eight.vercel.app/v1/health
```

Do **not** monitor authenticated routes or cron URLs — health is unauthenticated
and rate-limit friendly.

## Better Stack (formerly Better Uptime)

1. Create monitor → **HTTP(s)** → URL above.
2. Method: GET; interval: **1–3 minutes**.
3. Success: status 200; optional keyword check: `"status":"ok"`.
4. Alert channels: email + Slack/Teams as needed.
5. Optional: status page for stakeholders.

Docs: [Better Stack uptime monitors](https://betterstack.com/docs/uptime/)

## UptimeRobot

1. Monitor type: **HTTP(s)**.
2. URL: `https://<api>/v1/health`.
3. Monitoring interval: 5 minutes (free tier) or 1 minute (paid).
4. Alert contacts: at least two people for production.

Docs: [UptimeRobot — creating a monitor](https://uptimerobot.com/help/)

## What to alert on

| Signal | Action |
|---|---|
| 2+ consecutive failures | Page on-call; check [Vercel status](https://www.vercel-status.com/) |
| 200 but slow (>5s) | Turso latency or cold start; check function logs |
| 503 on `/v1/cron/*` only | Missing `CRON_SECRET` — not an uptime issue for health monitor |

## Optional: frontend checks

Add separate monitors (or Better Stack multi-step) for:

- `https://hotel-os-ai-admin-<suffix>.vercel.app/` (200)
- Executive / Guest / Work / www marketing homepages

Frontend 404/5xx often means a bad deploy, not API outage.

## In-product live probe (not a hosted status page)

Marketing www exposes `#status`, which calls `GET /v1/health` for **this**
deployment only (via www Edge `middleware.ts` → API, same pattern as staff
apps). Set `HOTELOS_API_ORIGIN` on the www Vercel project when the hostname
does not auto-map to `-api-`.

This is **not** a historical uptime / incident page. For stakeholder history,
use Better Stack / UptimeRobot status pages (steps above) and link them from
Trust Center only after they exist.

## Related

- [staging-production-checklist.md](./staging-production-checklist.md)
- [vercel.md](./vercel.md)
- [trust-center-mvp.md](../planning/trust-center-mvp.md)
