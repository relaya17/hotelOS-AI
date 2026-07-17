# Runbook — API down / Failed to fetch

**Version:** 1.0 · **Status:** ✅ Approved

## Symptoms

Login shows "Failed to fetch"; apps on 5173–5175 cannot reach `:3001`.

## Checks

1. `Get-NetTCPConnection -LocalPort 3001` — process listening?
2. Restart: `pnpm --filter @hotelos/api dev`
3. After schema change: rebuild `@hotelos/database` (`pnpm --filter @hotelos/database build`) then restart API
4. Verify: `POST /v1/auth/login` with demo credentials
5. Check `.env` has `DATABASE_URL=file:.data/hotelos.sqlite` (or Turso URL)

## Escalation

If migrate fails — inspect `packages/database/src/client.ts` migrate SQL; wipe local `.data` only in demo (not prod).
