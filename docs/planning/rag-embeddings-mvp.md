# RAG / Embeddings MVP — status (honest)

**Updated:** 2026-08-04  
**Rule:** Do not market “full Vector DB / semantic RAG production” until managed
vector index + evals ship. Keyword path remains the reliable default.

## Live today

| Piece | Where |
|-------|--------|
| Company Knowledge keyword search → Gateway pack | `build-knowledge-context-pack.ts` |
| Trusted Sources allowlist → Gateway pack | `build-trusted-sources-context-pack.ts` |
| Whole-doc embedding table | `company_knowledge_embeddings` |
| **Text chunks** (paragraph/size split) | `company_knowledge_chunks` — written on approve |
| **Per-chunk embeddings** (nullable columns on chunks) | `embedding_json` / model / dims / embedded_at |
| Pack snippets prefer best cosine chunk (fallback keyword) | `build-knowledge-context-pack.ts` |
| Chunk vector search merges docs into packs | `searchChunksByEmbedding` |
| Lazy chunk (+ optional chunk embed) backfill | `build-knowledge-context-pack.ts` |
| Manual reindex (doc embed + chunk + chunk embed) | `POST .../reindex` + Admin «רענון אינדקס» |
| Upsert / cosine search APIs on repository | `company-knowledge-repository.ts` |
| Embed + chunk + chunk-embed on approve (best-effort) | `knowledge-routes.ts` |
| OpenAI-compatible `/embeddings` provider | `packages/ai-gateway` |

When embeddings / chunks are unavailable, packs fall back to keyword + body
prefix — Gateway still never searches the DB itself (Vol. 5 / ADR 0008).

## Not live (roadmap)

- Dedicated Vector DB (or Turso vector index) with ANN
- Batch offline cron reindex for all historical docs (per-doc reindex + lazy pack fill are live)
- Citation UX per chunk in Admin/Executive
- Trusted-source page fetch + embed pipeline

## Public claims

Safe: “Company knowledge uses approved documents; optional whole-doc and
per-chunk embeddings when the AI provider supports them; packs can cite the
best-matching chunk; otherwise keyword retrieval.”  
Unsafe: “We have enterprise Vector RAG / SOC-backed knowledge graph.”
