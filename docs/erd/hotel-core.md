# ERD — Hotel core + ADR 0007

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Source of truth:** `packages/database/src/schema` + `client.ts` migrate

```mermaid
erDiagram
  TENANTS ||--o{ HOTEL_CHAINS : has
  HOTEL_CHAINS ||--o{ HOTELS : has
  HOTELS ||--o{ ROOMS : has
  HOTELS ||--o{ BOOKINGS : has
  HOTELS ||--o{ DEPARTMENTS : has
  TENANTS ||--o{ USERS : has
  TENANTS ||--o{ ORG_COMMS_CHANNELS : has
  ORG_COMMS_CHANNELS ||--o{ ORG_COMMS_MESSAGES : has
  TENANTS ||--o{ TRUSTED_SOURCES : has
  HOTELS ||--o{ KASHRUT_ANNOTATIONS : has
  TENANTS ||--o{ AUDIT_EVENTS : has

  HOTELS {
    string id PK
    string tenant_id
    int kashrut_enabled
  }
  ORG_COMMS_CHANNELS {
    string id PK
    string channel_key
    string name_he
  }
  ORG_COMMS_MESSAGES {
    string id PK
    string channel_id FK
    string from_role
    string body
  }
  TRUSTED_SOURCES {
    string id PK
    string title
    string url
    string category
  }
  KASHRUT_ANNOTATIONS {
    string id PK
    string hotel_id FK
    string target_kind
    string status
    string message
  }
```

Logical DBs (Vol. 6) may split later; v1 is a single libSQL file/Turso DB with tenant isolation in queries.
