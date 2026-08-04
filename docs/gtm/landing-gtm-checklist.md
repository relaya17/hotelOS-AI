# Landing / GTM change checklist

Use this on **every** change to `apps/www` marketing copy, pricing, meta tags, or JSON-LD — including AI-assisted commits.

## Before merge

- [ ] **H1 ↔ `<title>` ↔ og:title** — same core promise (no synonym drift).
- [ ] **hreflang / canonical** — Hebrew-only www is intentional ([locale-strategy.md](./locale-strategy.md)); do not add fake `en` alternates without real EN pages.
- [ ] **JSON-LD Offer** — `priceCurrency` + Pilot `price` match [`apps/www/src/list-prices.ts`](../../apps/www/src/list-prices.ts). Run: `node scripts/check-www-jsonld.mjs` (also covered by `@hotelos/www` tests).
- [ ] **PACKAGES / on-page prices** — strings reference the same USD amounts as list-prices (Pilot $5,000 · Network $1,000/mo · Enterprise from $75,000 ACV).
- [ ] **Honesty** — no SOC2 / ISO / PCI certification claims; no invented logos or measured ROI %.
- [ ] **Lead form** — primary path is `POST /v1/leads` with success/error UI; mailto is backup only.
- [ ] **Nav ↔ sections** — every `#anchor` in the header exists; orphan sections are either linked or intentionally removed.
- [ ] **Banned narrative voice** — speak *to* the buyer (אתם/שלכם), not about “ועדת הנהלה / שיווק נכון” in third person on www.

## After deploy (smoke)

- [ ] Open `/#contact`, submit a test lead (or confirm API + success banner).
- [ ] View source: JSON-LD still `USD` / Pilot `5000`.
- [ ] Share card preview (og:title / og:description) if meta changed.
