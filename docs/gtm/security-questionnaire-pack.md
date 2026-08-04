# Security questionnaire pack — HotelOS AI

**Status:** Buyer-ready answers for what is **live today**.  
**Not claimed:** SOC 2 / ISO 27001 attestation · HotelOS PCI-DSS certification.

## Identity & tenancy

| Question | Answer |
|----------|--------|
| Multi-tenant? | Yes — tenant isolation in data model and ACL |
| Hotel scope | Staff tokens scoped; SSE/ops streams hotel-scoped |
| Auth | Staff: session + WebAuthn / Google OAuth where enabled |

## AI

| Question | Answer |
|----------|--------|
| How is AI called? | Only via AI Gateway (Engineering Standard Vol. 5) |
| Can AI move money alone? | No — Suggest → Approve → Act (HITL) for sensitive ops |
| Training on customer data? | Do not claim vendor training; follow subprocessors + privacy docs |

## Payments / PCI

| Question | Answer |
|----------|--------|
| Store PAN? | No |
| Provider modes | `demo` / `stripe_stub` / `external` via API status — PAN at provider when external |
| HotelOS PCI-DSS cert? | Not claimed |

## Compliance artifacts (public)

| Artifact | Where |
|----------|-------|
| Terms / Privacy / Cookies / Security / Meetings / Accessibility | `@hotelos/legal` · Guest `/?doc=` · API public legal |
| DPA | Public **template** — counsel-signed per deal |
| Subprocessors | Legal doc |
| security.txt | `apps/www/public/.well-known/security.txt` |
| Trust UI | www `#trust` · `#status` |

## Availability

| Question | Answer |
|----------|--------|
| Health | `GET /v1/health` probed on www `#status` |
| Public status history | Optional `VITE_STATUS_PAGE_URL` when hosted |

## Roadmap (say this out loud)

- SOC 2 Type I path: see [soc2-attestation-checklist.md](./soc2-attestation-checklist.md)  
- Counsel-signed DPA per customer  
- External uptime page with history  

Send pack link + legal URLs with every enterprise RFP.
