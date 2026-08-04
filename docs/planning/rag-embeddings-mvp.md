# RAG / Embeddings MVP — status (honest)

**Updated:** 2026-08-04  
**Status:** Shippable MVP complete for **hybrid** retrieval (not Vector DB / ANN).  
**Rule:** Do not market “full Vector DB / semantic RAG production” until managed
vector index + evals ship. Keyword path remains the reliable default.

## Readiness board

| סטטוס | פריט |
|--------|------|
| **Closed (MVP)** | Trust Center product surfaces — [trust-center-mvp.md](./trust-center-mvp.md) |
| **Closed (MVP)** | RAG hybrid (keyword + optional embeddings + chunks + citations) |
| **Closed (MVP)** | Trusted allowlist page fetch → text snapshot (all categories) + pack use |
| **Closed (MVP)** | Trusted snapshot **embeddings** (best-effort via Gateway on fetch) |
| **Remaining** | Certifications (SOC 2 / ISO) |
| **Remaining** | Employee depth (Blob binary for sensitive HR intentionally hash-only) |
| **Remaining** | WCAG full suite (axe now covers login + www/guest public shells) |

## Live today

| Piece | Where |
|-------|--------|
| Company Knowledge keyword search → Gateway pack | `build-knowledge-context-pack.ts` |
| Trusted Sources allowlist → Gateway pack (+ **page snapshots** when fetched) | `build-trusted-sources-context-pack.ts` |
| Allowlist URL fetch → text snapshot + **optional embed** (all categories) | `ingestTrustedAllowlistFeeds` + cron `trusted-sources-refresh` |
| Finance-category subset still used by CFO daily | `ingestTrustedMarketFeeds` |
| Trusted pack hybrid keyword + snapshot cosine | `build-trusted-sources-context-pack.ts` |
| Structured citations (company chunk + trusted URL) | Gateway `citations` → Executive Ask + Admin chunk list |
| Whole-doc embedding table | `company_knowledge_embeddings` |
| **Text chunks** + **per-chunk embeddings** | `company_knowledge_chunks` |
| Pack snippets prefer best cosine chunk (fallback keyword) | `build-knowledge-context-pack.ts` |
| Lazy chunk (+ optional chunk embed) backfill | `build-knowledge-context-pack.ts` |
| Manual reindex | `POST .../reindex` + Admin «רענון אינדקס» |
| **Batch cron reindex** (missing chunks/embeddings) | `GET/POST /v1/cron/knowledge-reindex` (04:00 UTC) |
| Admin citation UX | `GET .../chunks` + «הצג ציטוטים» |
| Shared `@hotelos/ui` `CitationList` | Executive Ask / CIO / Finance Doctor |
| Snapshot DTO without vectors | `hasEmbedding` / `embeddedAt` on CFO snapshots API |
| OpenAI-compatible `/embeddings` provider | `packages/ai-gateway` |

When embeddings / chunks are unavailable, packs fall back to keyword + body
prefix — Gateway still never searches the DB itself (Vol. 5 / ADR 0008).

## Not live (roadmap)

- Dedicated Vector DB (or Turso vector index) with ANN + retrieval evals
- Admin Company Knowledge chunk inspector remains local (doc chunks ≠ Gateway citations)

## Public claims

Safe: “Company knowledge uses approved documents; optional whole-doc and
per-chunk embeddings when the AI provider supports them; answers can cite the
best-matching chunk; Trusted Sources may include fetched page snapshots and
optional snapshot embeddings from the approved allowlist; otherwise keyword
retrieval.”  
Unsafe: “We have enterprise Vector RAG / SOC-backed knowledge graph.”  
Unsafe: “HotelOS is SOC 2 / PCI certified.” (out of scope of this MVP; see trust-center-mvp.md)
