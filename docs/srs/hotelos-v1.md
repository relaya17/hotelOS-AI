# SRS — HotelOS AI v1

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Architecture + Product  
**PRD:** [hotelos-v1.md](../prd/hotelos-v1.md)

## Functional Requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-01 | Auth JWT + refresh + logout | Login/refresh/me/logout עובדים; 401 מרענן אוטומטית ב־web-client |
| FR-02 | Multi-hotel chain overview | Executive מציג KPIs + דורש תשומת לב |
| FR-03 | Room status update | PATCH status; UI chips ב־Admin |
| FR-04 | Booking check-in/out | Transitions + sync חדר |
| FR-05 | Guest stay lookup + hub | Lookup email; check-in ציבורי; folio; service request |
| FR-06 | Attendance clock | Geo/voice/signature/WebAuthn + מצב מהיר |
| FR-07 | Briefing rooms + agents | Share agent, consult rule-based, recordings |
| FR-08 | Turbo accounting/chat/automations/voice | Endpoints `/v1/turbo/*` |
| FR-09 | CIO digest by role | `GET /v1/ops/cio-digest?role=` |
| FR-10 | Org Comms channels/messages | `/v1/org-comms/*` |
| FR-11 | Trusted sources CRUD/list | `/v1/knowledge/trusted-sources` |
| FR-12 | Kashrut annotations | Enable per hotel + annotate targets |
| FR-13 | Rate limit | 429 על חריגה |
| FR-14 | Audit on writes | audit_events לכתיבות עסקיות עיקריות |

## Non-Functional

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | TypeScript strict | no `any`, exactOptionalPropertyTypes |
| NFR-02 | Multi-tenancy | כל שאילתה מסוננת ב־tenantId |
| NFR-03 | Accessibility | WCAG 2.2 AA; AAA על מסכי ליבה (Vol. 4) |
| NFR-04 | i18n | 10 שפות UI |
| NFR-05 | Security | ASVS L2 SaaS; security headers; least privilege agents |
| NFR-06 | Coverage | ≥70% לשכבות לוגיקה |
| NFR-07 | RPO/RTO | SaaS 24h/4h; Enterprise 1h/1h |

## Constraints

- אין קריאות LLM ישירות משכבת דומיין (Vol. 5)
- Trusted facts רק מ־allowlist
- כסף/מדיניות — human approval מעל סף ₪2,000 / 5% ADR
