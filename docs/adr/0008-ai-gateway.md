# ADR 0008 — AI Gateway as sole LLM entrypoint

**Status:** Accepted  
**Date:** 2026-07-18

## Context

Engineering Standard Vol. 5 / 5A forbids direct LLM calls from business logic. CIO and domain agents need a single policy, audit, and provider-routing layer. Deferring the Gateway indefinitely blocked “super advisor” product promises.

## Decision

1. Ship `@hotelos/ai-gateway` with `createAiGateway({ agents, openai?, onAudit })`.
2. HTTP entry: `GET /v1/ai/gateway/status`, `POST /v1/ai/gateway/invoke` (JWT + tenant scope).
3. Providers:
   - **deterministic** — always available (no key)
   - **openai_compatible** — when `AI_GATEWAY_API_KEY` is set (`AI_GATEWAY_BASE_URL`, `AI_GATEWAY_MODEL`)
4. Remote failure → automatic fallback to deterministic + audit.
5. Human-approval flag for money/policy hints and `suggest` autonomy agents.
6. Executive CIO page can ask the Gateway with an authorized context pack from the live digest.

## Consequences

- Apps never call OpenAI/Azure SDKs directly.
- Local demo works without paid keys; production enables LLM via env only.
- Full RAG / Vector DB remain next increments on top of this Gateway.
