# Lead ops — monitoring marketing leads

After `POST /v1/leads`, HotelOS:

1. Persists a row in `marketing_leads`
2. Writes audit `marketing.lead.created` under the platform/demo tenant (best-effort; never fails the HTTP response)
3. Logs `marketing lead created` via the API logger

## What you still do manually

- [ ] Confirm `pilot@hotelos.ai` inbox is monitored (mailto backup)
- [ ] Confirm someone reads new `marketing_leads` / audit rows (daily or Slack/Turso query)
- [ ] Fill `VITE_CALENDLY_URL` / `VITE_DEMO_VIDEO_URL` in www env when ready

## Quick Turso / local check

```sql
SELECT id, name, hotel_or_chain, email, source, created_at
FROM marketing_leads
ORDER BY created_at DESC
LIMIT 20;
```

```sql
SELECT created_at, action, resource_id, metadata_json
FROM audit_events
WHERE action = 'marketing.lead.created'
ORDER BY created_at DESC
LIMIT 20;
```

Cross-link: [business-fill.md](./business-fill.md) §C · [landing-gtm-checklist.md](./landing-gtm-checklist.md).
