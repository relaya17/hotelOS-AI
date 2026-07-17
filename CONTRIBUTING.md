# Contributing to HotelOS AI

Thanks for contributing. This repo is governed by the **HotelOS AI Engineering Standard v1.0 (Approved)** — read [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) and [`AGENTS.md`](AGENTS.md) before opening a PR. Every change must comply 100% with the standard (Golden Rule, [`00-GOLDEN-RULES.md`](docs/engineering-standard/00-GOLDEN-RULES.md)) — non-compliant code is not merged.

## Setup

```bash
pnpm install
pnpm dev            # api + executive + admin + guest
pnpm typecheck
pnpm lint
pnpm test
pnpm qa             # install --frozen-lockfile -> typecheck -> lint -> test -> build
```

Requires Node ≥ 22 and pnpm 9 (see `package.json`).

## Before you open a PR

- [ ] No `any` — `strict` TypeScript only ([Vol. 2](docs/engineering-standard/02-software-engineering.md))
- [ ] Controller → Service → Repository → Database only; no direct LLM calls from business code ([Vol. 5](docs/engineering-standard/05-ai-platform.md))
- [ ] Input validated at every boundary (Zod)
- [ ] AuthZ checked in the application layer, not just the UI
- [ ] i18n keys for user-facing text (no hardcoded strings)
- [ ] No secrets committed
- [ ] ADR added under `docs/adr/` for material architecture decisions
- [ ] OpenAPI / ERD updated if a contract changed
- [ ] Accessibility: WCAG 2.2 AA minimum; AAA required for the screens listed in [Vol. 4 §4.2.1](docs/engineering-standard/04-accessibility.md)
- [ ] Relevant tests added (70% line coverage minimum for packages with logic — [Vol. 9](docs/engineering-standard/09-qa.md))

## PR Gate (CI, blocking)

Type Check · Lint · Unit Tests · Integration Tests · Build · Security Scan · Dependency Scan · Secret Scan · Accessibility Scan (UI) · Performance Budget (UI). If any of these fail, the PR cannot merge.

## Commit style

Concise, imperative subject line (e.g. `fix: prevent cross-tenant room lookup`). Reference the relevant Engineering Standard volume or ADR when the change implements or amends one.

## Where to look first

| Question | Answer lives in |
|---|---|
| Product vision / roadmap | [Vol. 1](docs/engineering-standard/01-vision-product-strategy.md) |
| Coding standards, monorepo layout | [Vol. 2](docs/engineering-standard/02-software-engineering.md) |
| AI Agents (adding/changing one) | [Vol. 11](docs/engineering-standard/11-ai-agents/README.md) — use [`00-AGENT-TEMPLATE.md`](docs/engineering-standard/11-ai-agents/00-AGENT-TEMPLATE.md) |
| Security / auth | [Vol. 8](docs/engineering-standard/08-security.md) |
| Database / schema changes | [Vol. 6](docs/engineering-standard/06-database.md), `docs/erd/` |
| Deployment | [`docs/deployment/vercel.md`](docs/deployment/vercel.md) |

Questions the standard doesn't answer go to the Product Owner / Chief Architect — do not silently deviate.
