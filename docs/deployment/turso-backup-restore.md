# Turso backup and restore

HotelOS production uses [Turso](https://turso.tech) (`libsql://…`) on Vercel.
Local dev may still use `file:.data/hotelos.sqlite` — that file is **not** backed
up by Turso; copy it manually if needed.

## Quick connectivity check

```bash
pnpm ping:turso
# or: node scripts/ping-turso.mjs
```

Uses `DATABASE_URL` + `DATABASE_AUTH_TOKEN` from `apps/api/.env` or root `.env`.
Never commit tokens.

## Backup (operator)

Turso CLI (see [Turso docs — backup](https://docs.turso.tech/cli/backup)):

```bash
turso auth login
turso db shell hotelos-prod ".backup main backup-$(date +%Y%m%d).db"
# or export via periodic snapshots / point-in-time per your Turso plan
```

**Recommended cadence:** daily automated backup for production; retain at least
7 daily + 4 weekly copies off-platform (S3, Azure Blob, etc.).

For staging, use a **separate database** and the same procedure with a
`hotelos-staging` name.

## Restore (disaster recovery drill)

1. Create a new DB or use Turso restore flow per
   [Restore from backup](https://docs.turso.tech/cli/backup#restore).
2. Issue a new auth token: `turso db tokens create <db-name>`.
3. Update Vercel API env: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`.
4. Redeploy API (after any Hobby rate-limit window).
5. Verify: `pnpm check:vercel-api` and `GET /v1/health`.
6. Run smoke login on one frontend.

Document the drill date and RTO/RPO in your ops runbook.

## Seed / empty staging

To populate a fresh staging DB with demo data:

```bash
node scripts/seed-turso.mjs
```

Use only on non-production databases.

## Related

- [vercel.md](./vercel.md) — Turso setup (step 0)
- [staging-production-checklist.md](./staging-production-checklist.md)
