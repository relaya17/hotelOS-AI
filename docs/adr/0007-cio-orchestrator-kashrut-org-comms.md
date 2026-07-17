# ADR 0007 — CIO orchestrator, Trusted knowledge, Kashrut supervisor, org comms

**Status:** Accepted  
**Date:** 2026-07-18

## Context

Chain executives need a single “super advisor” experience: accounting-grade judgment, economic strategy, fraud/anomaly alerts, daily role-based briefings, and continuous market/design intel from **verified** external sources. Simultaneously, kosher hotels need a **משגיח כשרות** voice that can comment on any relevant decision, and ownership/leadership need **direct channels** across the hierarchy (owner ↔ CEO ↔ PR / HR / F&B / rooms & housekeeping / reception / …).

Engineering Standard Vol. 11 forbids one unbounded generic agent. The product front may feel like one advisor; the platform must remain an orchestrator over specialists + allowlisted knowledge.

## Decision

1. **CIO Orchestrator** (`agent.cio`) — front-door advisor that routes to domain agents (CEO, CFO, Revenue, Legal, …), synthesizes answers, and never bypasses AI Gateway, least-privilege tools, or human approval for money/policy.
2. **Trusted Knowledge only for external facts** — allowlisted sources (regulators, universities, certified market data, approved kashrut authorities). Open web/Google Search may be used only as *discovery* behind a gate that requires citation + allowlist approval before advice is actionable.
3. **Kashrut Supervisor Agent** (`agent.kashrut`) — always-on advisory seat for kosher-relevant ops (kitchen, F&B, events, procurement, Shabbat modes). Can attach a **כשרות note** to briefings, automations, and purchasing proposals. Escalates to human משגיח + F&B / GM / owner when blocked.
4. **Org Comms Graph** — first-class channels (not only informal chat):
   - Owner ↔ CEO (executive private)
   - CEO ↔ PR, HR, F&B, Rooms/HK, Reception, Maintenance, Security, Finance
   - Optional: משגיח כשרות ↔ F&B + GM (compliance lane)
   - Daily briefing delivery per role in the hierarchy
5. Specs live under Vol. 11: [cio-agent.md](../engineering-standard/11-ai-agents/cio-agent.md), [kashrut-agent.md](../engineering-standard/11-ai-agents/kashrut-agent.md). Implementation is phased (P6+); UI may stub seating in briefing rooms before full Gateway.

## Consequences

- README and Vol. 11 catalog list CIO + Kashrut + org channels as product intent.
- Fraud/theft/non-reporting alerts are CFO/Security tools invoked by CIO — not silent autonomous fund moves.
- Hotels without kashrut simply disable `agent.kashrut` / hide the seat; schema keeps the slot.
- External market/design intel requires Knowledge approval workflow; hallucinations without citations are non-compliant.
