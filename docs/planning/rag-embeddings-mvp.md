# RAG / Embeddings MVP — status (honest)

**Updated:** 2026-08-04  
**Rule:** Do not market “full Vector DB / semantic RAG production” until managed
vector index + evals ship. Keyword path remains the reliable default.

## Live today

| Piece | Where |
|-------|--------|
| Company Knowledge keyword search → Gateway pack | `build-knowledge-context-pack.ts` |
| Trusted Sources allowlist → Gateway pack | `build-trusted-sources-context-pack.ts` |
| Embedding table (one vector per approved doc) | `company_knowledge_embeddings` |
| **Text chunks** (paragraph/size split) | `company_knowledge_chunks` — written on approve |
| Pack snippets prefer best-matching chunk | `build-knowledge-context-pack.ts` |
| Upsert / cosine search APIs on repository | `company-knowledge-repository.ts` |
| Embed + chunk on approve (best-effort) | `knowledge-routes.ts` |
| OpenAI-compatible `/embeddings` provider | `packages/ai-gateway` |

When embeddings / chunks are unavailable, packs fall back to keyword + body
prefix — Gateway still never searches the DB itself (Vol. 5 / ADR 0008).

## Not live (roadmap)

- Per-chunk embeddings (only whole-doc vectors today)
- Dedicated Vector DB (or Turso vector index) with ANN
- Offline re-embed / re-chunk backfill job for historical docs
- Citation UX per chunk in Admin/Executive
- Trusted-source page fetch + embed pipeline

## Public claims

Safe: “Company knowledge uses approved documents; optional embeddings when the
AI provider supports them; packs can cite document chunks; otherwise keyword
retrieval.”  
Unsafe: “We have enterprise Vector RAG / SOC-backed knowledge graph.”
