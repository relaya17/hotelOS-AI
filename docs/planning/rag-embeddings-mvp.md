# RAG / Embeddings MVP — status (honest)

**Updated:** 2026-08-04  
**Status:** Shippable MVP complete for hybrid retrieval (not Vector DB / ANN).  
**Rule:** Do not market “full Vector DB / semantic RAG production” until managed
vector index + evals ship. Keyword path remains the reliable default.

## Live today

| Piece | Where |
|-------|--------|
| Company Knowledge keyword search → Gateway pack | `build-knowledge-context-pack.ts` |
| Trusted Sources allowlist → Gateway pack | `build-trusted-sources-context-pack.ts` |
| Structured citations (company chunk + trusted URL) | Gateway `citations` → Executive Ask + Admin chunk list |
| Whole-doc embedding table | `company_knowledge_embeddings` |
| **Text chunks** + **per-chunk embeddings** | `company_knowledge_chunks` |
| Pack snippets prefer best cosine chunk (fallback keyword) | `build-knowledge-context-pack.ts` |
| Lazy chunk (+ optional chunk embed) backfill | `build-knowledge-context-pack.ts` |
| Manual reindex | `POST .../reindex` + Admin «רענון אינדקס» |
| **Batch cron reindex** (missing chunks/embeddings) | `GET/POST /v1/cron/knowledge-reindex` (04:00 UTC) |
| Admin citation UX | `GET .../chunks` + «הצג ציטוטים» |
| OpenAI-compatible `/embeddings` provider | `packages/ai-gateway` |

When embeddings / chunks are unavailable, packs fall back to keyword + body
prefix — Gateway still never searches the DB itself (Vol. 5 / ADR 0008).

## Not live (roadmap)

- Dedicated Vector DB (or Turso vector index) with ANN + retrieval evals
- Trusted-source **page fetch → embed** for all allowlist categories (finance snapshot ingest exists for CFO)
- Shared `@hotelos/ui` `CitationList` component (Admin/Executive ship local lists today)

## Public claims

Safe: “Company knowledge uses approved documents; optional whole-doc and
per-chunk embeddings when the AI provider supports them; answers can cite the
best-matching chunk; otherwise keyword retrieval.”  
Unsafe: “We have enterprise Vector RAG / SOC-backed knowledge graph.”
