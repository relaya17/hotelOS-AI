# RAG / Embeddings MVP — status (honest)

**Updated:** 2026-08-04  
**Rule:** Do not market “full Vector DB / semantic RAG production” until chunking +
managed vector index + evals ship. Keyword path remains the reliable default.

## Live today

| Piece | Where |
|-------|--------|
| Company Knowledge keyword search → Gateway pack | `build-knowledge-context-pack.ts` |
| Trusted Sources allowlist → Gateway pack | `build-trusted-sources-context-pack.ts` |
| Embedding table (one vector per approved doc) | `company_knowledge_embeddings` |
| Upsert / cosine search APIs on repository | `company-knowledge-repository.ts` |
| Embed on approve (best-effort) | `knowledge-routes.ts` + `embed-company-knowledge-doc.ts` |
| Hybrid pack: keyword + optional embedding hits | `build-knowledge-context-pack.ts` |
| OpenAI-compatible `/embeddings` provider | `packages/ai-gateway` |

When embeddings are unavailable or empty, packs fall back to keyword — Gateway
still never searches the DB itself (Vol. 5 / ADR 0008).

## Not live (roadmap)

- Chunking / multi-vector per document
- Dedicated Vector DB (or Turso vector index) with ANN
- Offline re-embed backfill job for all historical docs
- Citation UX per chunk in Admin/Executive
- Trusted-source page fetch + embed pipeline

## Public claims

Safe: “Company knowledge uses approved documents; optional embeddings when the
AI provider supports them; otherwise keyword retrieval.”  
Unsafe: “We have enterprise Vector RAG / SOC-backed knowledge graph.”
