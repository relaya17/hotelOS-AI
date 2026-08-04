# פערים מול עולמי — משקיעים + מכירת מלונות

**תאריך:** 2026-08-04  
**מטרה:** מה חסר כדי לגייס משקיעים ולסגור רשתות/מלונות, בהשוואה לסטנדרט SaaS עולמי (Mews / Cloudbeds / Alice-class sales + Enterprise trust).  
**כלל זהב:** רק מה שחי בקוד — אין SOC 2 / ISO / PCI של HotelOS עד שיש attestation. ראו [trust-center-mvp.md](./trust-center-mvp.md).

---

## מצב נוכחי (כנה)

| ממד | ציון יחסי | הערה |
|-----|-----------|------|
| עומק מוצר (Wedge) | ~7/10 | תדריך, Incidents, PM MVP, HITL, Executive/Admin/Guest/Work |
| אתר מכירה (`@hotelos/www`) | ~5/10 | מסר חזק, בלי proof / demo / pricing / logos |
| מוכנות משקיע | ~3/10 | Pitch ב־Markdown, בלי traction / unit economics / data room |
| אמון Enterprise | ~4/10 | בקרות חיות טובות; חסרות תעודות + DPA חתום + status חיצוני |

**מסקנה:** הפער העיקרי אינו «עוד פיצ׳ר» — אלא **הוכחה מסחרית + נכסי מכירה + אמון לסגירה**.

---

## מה כבר יש (אל תבזבזו כאן)

- Positioning נכון: Intelligence Layer מעל PMS ([competitive-wedge.md](./competitive-wedge.md), [gtm-outcomes-pitch.md](./gtm-outcomes-pitch.md))
- www: hero, outcomes, wedge, compare, intelligence, FAQ, `#trust`, `#status`, CTA פיילוט
- Pilot ROI Scorecard (תבנית): [pilot-roi-scorecard.md](./pilot-roi-scorecard.md)
- Pitch outline: [10-10-pitch-deck.md](./10-10-pitch-deck.md)
- **NEW:** [one-pager-hotel.md](./one-pager-hotel.md) · [one-pager-investor.md](./one-pager-investor.md) · [pitch-deck-12-slides.md](./pitch-deck-12-slides.md)
- Trust surfaces כנות: legal, HITL, WebAuthn/OAuth, security.txt, no PAN in HotelOS
- **www GTM sections:** `#how-pilot` · `#packages` · `#integrations` · lead form ב־`#contact` (+ `VITE_CALENDLY_URL`)

---

## A. פערים מול בעלי מלון / רשתות

| עדיפות | פער | סטנדרט עולמי | פעולה |
|--------|-----|--------------|--------|
| **P0** | אין דמו חי / וידאו | Guided demo או 90s video | הקלטת wedge (CIO + Incidents + Approve) בעברית+אנגלית; אופציונלי sandbox |
| **P0** | אין social proof | לוגואים + case study עם מספרים | 1–2 design partners + הסכמה לציון שם או «רשת בוטיק ב…» |
| **P0** | ROI ריק | מספרים מפיילוט / מחשבון | למלא [pilot-roi-scorecard.md](./pilot-roi-scorecard.md) שבוע 0→30 עם רשת אמיתית |
| **P1** | אין חבילות | Pilot / Network / Enterprise | דף «איך קונים» — גם בלי מחיר קשיח |
| **P1** | mailto בלבד | Calendly + CRM | טופס ליד / קביעת שיחה ב־www `#contact` |
| **P1** | Integrations לא ויזואליים | לוגו PMS + channels | בלוק Opera / Protel / Fidelio / Clock + «read-only / HITL» |
| **P1** | אין playbook פיילוט על האתר | «Go-live ב־4 שבועות» | ציר זמן: חיבור → baseline → שבוע 2 ערך → שבוע 4 החלטת הרחבה |
| **P2** | SOC2 / ISO / status | תגי אמון | לא לזייף; להתחיל attestation + Better Stack כשמוכנים תקציבית |
| **P2** | DPA counsel | חוזה חתום | Template כבר ציבורי — נדרש counsel לעסקה |

---

## B. פערים מול משקיעים

| עדיפות | פער | סטנדרט עולמי | פעולה |
|--------|-----|--------------|--------|
| **P0** | אין Traction | Paying / LOI / pilot signed | יעד: 1 פיילוט חתום + 1 LOI לרשת תוך 30–60 יום |
| **P0** | אין deck לשליחה | PDF 10–12 שקפים | להפוך [10-10-pitch-deck.md](./10-10-pitch-deck.md) ל־PDF + one-pager |
| **P0** | אין unit economics | ACV, CAC, payback, GM% | אפילו מודל Excel פשוט לפי חבילת פיילוט |
| **P1** | TAM/SAM/SOM בלי מקורות | שוק עם ציטוטים | ישראל + EU boutique/midscale chains — מקורות פומביים |
| **P1** | Moat בלי מספרים | Data / workflow / multi-hotel proof | אחרי פיילוט: זמן תדריך, MTTA incidents, upsell accept % |
| **P1** | Team / use of funds | שקף ברור | צוות + 18 חודשי runway לפי סבב |
| **P1** | Legal / IP | Entity, IP assignment | לוודא חברה + בעלות קוד מול קבלנים |
| **P2** | Data room מלא | Cap, contracts, security questionnaire | אחרי שיש traction בסיסי |

---

## תוכנית 90 יום (מומלצת)

### ימים 1–30 — הוכחה

1. חתימת design partner (רשת קטנה–בינונית עם PMS קיים).
2. Baseline על Pilot ROI Scorecard.
3. וידאו דמו 90 שנ׳ (wedge בלבד).
4. One-pager למלון + one-pager למשקיע (PDF).
5. החלפת `mailto` ב־Calendly / טופס ליד ב־www.

### ימים 31–60 — מכירה באתר

1. לוגואים / «בפיילוט עם…» (בהסכמה).
2. בלוק Integrations + חבילות Pilot/Network/Enterprise.
3. ציר זמן פיילוט 4 שבועות על www.
4. Deck 12 שקפים מוכן לשליחה.
5. מדידה ראשונה אחרי 30 יום על ה־scorecard.

### ימים 61–90 — אמון + גיוס

1. פרסום מספרי ROI אמיתיים (או case study אנונימי אם נדרש).
2. התחלת תהליך SOC 2 Type I / vendor questionnaire pack.
3. DPA חתום counsel.
4. Status page חיצוני (`VITE_STATUS_PAGE_URL`).
5. Data room מינימלי למשקיעים.

---

## מה **לא** לעשות עכשיו

- לא rip-and-replace PMS
- לא SOC2 / ISO / PCI בשיווק בלי attestation
- לא 3D Twin מלא / הרחבות רחוקות מה־wedge
- לא «עוד עשר פיצ׳רים» לפני שיש פיילוט עם מספרים

כל השקעת פיתוח קרובה צריכה לשרת אחד מ: **סגירת פיילוט · מדידת ROI · נכס מכירה · אמון לסגירת עסקה**.

---

## קישורים פנימיים

- [gtm-outcomes-pitch.md](./gtm-outcomes-pitch.md)
- [competitive-wedge.md](./competitive-wedge.md)
- [pilot-roi-scorecard.md](./pilot-roi-scorecard.md)
- [10-10-pitch-deck.md](./10-10-pitch-deck.md)
- [trust-center-mvp.md](./trust-center-mvp.md)
- [hotel-intelligence-platform.md](./hotel-intelligence-platform.md)

Canvas ויזואלי בצד הצ׳אט: `gtm-investor-gaps.canvas.tsx`
