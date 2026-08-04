# Locale strategy — www site vs. sales collateral

**Decision date:** 2026-08-04
**Status:** Decided. Revisit only when a trigger below fires.

## The decision

Two different surfaces, two different locale rules — do not conflate them:

| Surface | Locale | Why |
|---|---|---|
| **`apps/www` (public site)** | Hebrew only. No lang switcher, no `?lang=` param, single canonical URL. | Sales-assisted motion, not self-serve. The site's job is to qualify a hotel chain and get them on a call — not to close the deal in every language. |
| **Sales pack (`docs/gtm/sales-pack/pricing/*`)** | 10 locales (he/en/ar/ru/es/th/zh/hi/tr/el), verified. | This is what a rep hands a prospect *in the language of that specific conversation*. Multilingual reach lives here, not on the website. |

Pricing itself is already locale-independent: **one USD list worldwide** (Pilot $5,000, Network $1,000/hotel/month, Enterprise from $75,000 ACV) — see `sales-pack/pricing-talk-track.md`. So there is no pricing-consistency reason to fork the site by locale either.

## Why this was worth writing down

Before today, the site's `<head>` claimed an English alternate (`hreflang="en"` → `/?lang=en`, plus `og:locale:alternate: en_US`) that pointed at a query param the app never reads — there is no lang-switch logic anywhere in `apps/www`. That's a dangling promise: a real risk is someone "fixing" it later by bolting on a partial English mode instead of deciding on purpose. This doc is that decision, made on purpose, so the next person (human or agent) doesn't have to guess.

The metadata was already corrected to match this decision (2026-08-04): removed the fake `hreflang="en"`, removed `og:locale:alternate`, set `inLanguage` to `"he"` only in the JSON-LD `WebSite` node. Kept `hreflang="x-default"` pointing at the same Hebrew URL, which is correct when there's only one locale.

## Trigger conditions to revisit

Don't add a second site locale speculatively. Revisit only when one of these actually happens:

- A design partner or paying customer outside Israel is signed and the site itself (not just the sales pack) needs to be the leave-behind.
- Organic/paid traffic from non-Hebrew markets becomes a measurable acquisition channel (i.e., the site needs to *rank and convert* on its own, not just back up a live sales conversation).
- The motion shifts from sales-assisted to any form of self-serve signup, where a prospect might complete the funnel without ever talking to a rep.

If none of these are true, keep `apps/www` single-locale and put translation effort into the sales pack instead.

## Adjacent note (lead capture)

`POST /v1/leads` persists www contact form submissions to `marketing_leads`. Mailto (`pilot@hotelos.ai`) remains a **backup** only. `docs/gtm/business-fill.md` may still have `מייל pilot@ מנוטר?` unchecked — worth confirming ops monitoring / email alert on new rows before scaling paid traffic to `#contact`.
