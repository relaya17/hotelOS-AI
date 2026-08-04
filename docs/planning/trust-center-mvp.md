# Trust Center MVP — HotelOS AI

**Updated:** 2026-08-04  
**Rule:** Only claim what the product actually ships. No invented certifications.

## Live today (honest)

| Surface | Where |
|---------|--------|
| Legal docs (terms / privacy / cookies / security / meetings / subprocessors / **DPA template**) | `@hotelos/legal` → `GET /v1/public/legal` → Guest `/?doc=` |
| Legal footer + cookie banner | www, Admin, Executive, Work, Guest |
| www trust section `#trust` | Live controls only + links to security / subprocessors / DPA template |
| www status section `#status` | Live `GET /v1/health` probe (not a third-party uptime page) |
| www footer grid | Product / Trust / Start columns + legal bar |
| `security.txt` | `apps/www/public/.well-known/security.txt` |
| HITL Suggest→Approve→Act | Approvals UI + autonomy routes |
| WebAuthn / Google OAuth (staff) | Trust / login flows |
| API rate limits + AI rate budget | API middleware |
| SSE ops stream ACL (Bearer + hotel scope) | Stream routes + threat model doc |
| No PAN storage in HotelOS | Config / payment provider + `GET /v1/public/payments/status` + Guest/Executive copy |
| AI only via Gateway | Engineering Standard Vol. 5 |
| Hybrid keyword + optional embeddings | [rag-embeddings-mvp.md](./rag-embeddings-mvp.md) |

## Roadmap (not claimed on www)

- SOC 2 / ISO attestation pack
- Counsel-**signed** DPA per customer (public page is an **unsigned template**)
- Hosted third-party status page with history (Better Stack / similar)
- Live external PCI gateway UX (beyond `PAYMENT_PROVIDER=external` + provider-side PCI)
- Full cookie category matrix (analytics/marketing) if introduced
- Full Vector DB / chunked RAG (see rag-embeddings-mvp.md)

## Public narrative

www `#trust` lists only live controls and links to Security / Subprocessors / DPA template.  
www `#status` probes this deployment’s API health and points to the uptime runbook for continuous external monitoring.  
Guest/Executive payment UI reads **provider mode from the API** (`demo` / `stripe_stub` / `external`) and never claims HotelOS PCI-DSS.
