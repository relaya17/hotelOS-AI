# Trust Center MVP — HotelOS AI

**Updated:** 2026-08-04  
**Rule:** Only claim what the product actually ships. No invented certifications.

## Readiness board

| סטטוס | פריט |
|--------|------|
| **Closed (MVP)** | Trust Center product surfaces (this doc) |
| **Closed (MVP)** | RAG hybrid MVP — see [rag-embeddings-mvp.md](./rag-embeddings-mvp.md) |
| **Remaining** | Certifications (SOC 2 / ISO attestation) · counsel-signed DPA per customer |
| **Remaining** | Employee depth |
| **Remaining** | WCAG full suite (beyond login axe + foundations) |

## Live today (honest)

| Surface | Where |
|---------|--------|
| Legal docs (terms / privacy / cookies / security / meetings / subprocessors / **DPA template** / **accessibility**) | `@hotelos/legal` → `GET /v1/public/legal` → Guest `/?doc=` |
| Legal footer + cookie banner | www, Admin, Executive, Work, Guest |
| www trust section `#trust` | Live controls only + links to security / subprocessors / DPA template |
| www status section `#status` | Live `GET /v1/health` probe; optional `VITE_STATUS_PAGE_URL` link when set |
| www footer grid | Product / Trust / Start columns + legal bar |
| `security.txt` | `apps/www/public/.well-known/security.txt` |
| HITL Suggest→Approve→Act | Approvals UI + autonomy routes |
| WebAuthn / Google OAuth (staff) | Trust / login flows |
| API rate limits + AI rate budget | API middleware |
| SSE ops stream ACL (Bearer + hotel scope) | Stream routes + threat model doc |
| No PAN storage in HotelOS | Config / payment provider + `GET /v1/public/payments/status` + Guest/Executive copy |
| AI only via Gateway | Engineering Standard Vol. 5 |
| Hybrid keyword + optional embeddings + **text chunks** + citations | [rag-embeddings-mvp.md](./rag-embeddings-mvp.md) |

## Roadmap (not claimed on www)

- SOC 2 / ISO attestation pack — **do not claim** until attestation exists
- Counsel-**signed** DPA per customer (public page is an **unsigned template**)
- Hosted third-party status page with history (set `VITE_STATUS_PAGE_URL` once Better Stack / similar exists)
- Live external card-capture UX — `PAYMENT_PROVIDER=external` keeps PAN at the **provider**; HotelOS never claims its own PCI-DSS certification
- Full cookie category matrix (analytics/marketing) if introduced
- Full Vector DB / ANN index (hybrid RAG MVP is live — see rag-embeddings-mvp.md)
- Employee depth · WCAG full suite

## Public narrative

www `#trust` lists only live controls and links to Security / Subprocessors / DPA template.  
www `#status` probes this deployment’s API health and points to the uptime runbook for continuous external monitoring.  
Guest/Executive payment UI reads **provider mode from the API** (`demo` / `stripe_stub` / `external`) and never claims HotelOS PCI-DSS.  
www copy explicitly states there is **no** SOC 2 / ISO statement to sell.

## MVP close note

Trust Center **product surfaces** and hybrid RAG **shippable MVP** are closed for honest GTM. Remaining items above are certifications, counsel workflows, Employee/WCAG depth, or infra scale — not unfinished landing/API honesty work.
