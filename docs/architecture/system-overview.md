# Architecture — System Overview

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Chief Architect

## Runtime topology

```mermaid
flowchart LR
  subgraph clients [Clients]
    EX[Executive :5173]
    AD[Admin :5174]
    GU[Guest :5175]
  end
  API[API Hono :3001]
  DB[(libSQL / Turso)]
  EX --> API
  AD --> API
  GU --> API
  API --> DB
```

## Layering (Clean Architecture)

```mermaid
flowchart TB
  P[Presentation HTTP routes] --> A[Application use-cases]
  A --> D[Domain / Shared]
  A --> I[Infrastructure repos compose]
  I --> DB[(Database package)]
```

## Apps responsibility

| App | Scope |
|-----|--------|
| Executive | Chain KPIs, attention tower, Turbo, briefings, CIO digest, Org Comms, Trust |
| Admin | Hotel rooms/bookings, facilities, attendance, kashrut |
| Guest | Stay lookup/hub, legal docs, feedback |
| API | Auth, ops, turbo, trust, knowledge, kashrut, org-comms |

## ADR map

| ADR | Topic |
|-----|--------|
| 0001 | Monorepo |
| 0003 | Three apps |
| 0004 | Turbo OS |
| 0005 | Trust / attendance |
| 0006 | libSQL/Turso |
| 0007 | CIO / Kashrut / Org Comms |

See also: [05a-ai-architecture.md](../engineering-standard/05a-ai-architecture.md).
