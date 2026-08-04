# Trust Center MVP — HotelOS AI

**Updated:** 2026-08-04  
**Rule:** Only claim what the product actually ships. No invented certifications.

## Live today (honest)

| Surface | Where |
|---------|--------|
| Legal docs (terms / privacy / cookies / security / meetings) | `@hotelos/legal` → `GET /v1/public/legal` → Guest `/?doc=` |
| Legal footer + cookie banner | www, Admin, Executive, Work, Guest |
| www trust section `#trust` | Live controls only + link to security policy |
| www footer grid | Product / Trust / Start columns + legal bar |
| `security.txt` | `apps/www/public/.well-known/security.txt` |
| HITL Suggest→Approve→Act | Approvals UI + autonomy routes |
| WebAuthn / Google OAuth (staff) | Trust / login flows |
| API rate limits + AI rate budget | API middleware |
| SSE ops stream ACL (Bearer + hotel scope) | Stream routes + threat model doc |
| No PAN storage in HotelOS | Config / payment provider architecture |
| AI only via Gateway | Engineering Standard Vol. 5 |

## Roadmap (not claimed on www)

- SOC 2 / ISO attestation pack
- Public status page (uptime)
- Counsel-signed DPA / subprocessors schedule per customer
- Live external PCI gateway UX (beyond stub/demo)
- Full cookie category matrix (analytics/marketing) if introduced

## Public narrative

www `#trust` lists only live controls and links to the Security legal document.
