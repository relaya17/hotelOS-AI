# Developer Guide

**Version:** 1.0 · **Status:** ✅ Approved

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm typecheck
pnpm dev
```

Ports: API 3001 · Executive 5173 · Admin 5174 · Guest 5175.

## Packages of note

| Package | Role |
|---------|------|
| `@hotelos/database` | schema, migrate, seed, repos |
| `@hotelos/web-client` | API client + session |
| `@hotelos/features` | shared staff screens (attendance…) |
| `@hotelos/i18n` | UI dictionaries |
| `@hotelos/ui` | Button, TextField, CookieBanner, tokens |

## Adding an API route

1. Repository in `packages/database`
2. Application use-case if non-trivial
3. Route under `apps/api/src/presentation/http`
4. Wire `compose.ts` + `create-app.ts`
5. Client helper in `web-client`
6. Update `docs/openapi/README.md`

See [CONTRIBUTING.md](../../CONTRIBUTING.md).
