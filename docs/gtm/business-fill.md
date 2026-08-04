# Business fill — מה שנשאר אחרי סגירת הקוד

**סטטוס קוד/GTM:** סגור (live + ready checklists).  
**כאן:** רק מה שאת ממלאת כבעלת מוצר / מייסדת.

סמנו `✓` אחרי מילוי. אל תמציאו SOC2 / לוגו / ROI / ARR.

---

## A · תמחור (USD אחיד — נעול)

קובץ: [sales-pack/pricing-talk-track.md](./sales-pack/pricing-talk-track.md)

| חבילה | List USD |
|-------|----------|
| Pilot 8 weeks / hotel | **$5,000** (DP: $0 או $2,500) |
| Network / hotel / month | **$1,000** (שנתי prepaid $10,800) |
| Enterprise ACV / year | **from $75,000** |

- [x] מחיר אחיד USD לכל השווקים (כולל ישראל)
- [ ] הועתק לשיחות מכירה / PDF sales pack

---

## B · SOC2 Phase 0 (פנימי)

קובץ: [soc2-phase0.md](./soc2-phase0.md)

| שדה | ערך |
|-----|-----|
| Type I תחילה? | כן / לא |
| רבעון יעד | |
| Sponsor תקציב | |
| Shortlist ספקים (2+) | |

- [ ] Phase 0 מסומן כהושלם בצ׳קליסט

---

## C · ערוצי ליד / דמו

| פריט | ערך |
|------|-----|
| `VITE_CALENDLY_URL` | |
| `VITE_DEMO_VIDEO_URL` (אחרי הקלטה) | |
| מייל pilot@ מנוטר? | כן / לא |
| התראות על שורות חדשות ב־`marketing_leads` | כן / לא (ops) |

קוד האתר: טופס `#contact` שולח ל־`POST /v1/leads` (שמירה ב־DB). `mailto:pilot@` נשאר גיבוי בלבד.
עדיין נדרש אימות אנושי שמנטרים את תיבת `pilot@` ו/או יש תהליך על לידים חדשים.

- [ ] תרגול [demo-script-15min.md](./sales-pack/demo-script-15min.md)
- [ ] הקלטת 90 שנ׳ (wedge בלבד)

---

## D · Design partner #1

קובץ: [design-partner-checklist.md](./design-partner-checklist.md)

| שדה | ערך |
|-----|-----|
| רשת / מלון | |
| PMS | |
| אלוף פנימי | |
| תאריך kickoff | |
| מחיר פיילוט / waived | |
| הסכמה לשם באתר | כן / לא / אנונימי |

- [ ] נחתם  
- [ ] Scorecard שבוע 0 מלא  
- [ ] אם שם מותר → `VITE_PARTNER_NAMES`

---

## E · משקיע (אופציונלי עד שיש traction)

| שדה | ערך |
|-----|-----|
| סכום גיוס יעד | |
| Runway (חודשים) | |
| Use of funds % (לפי תבנית) | |
| Traction: pilots / LOI | 0 עד שיסומן אחרת |

- [ ] [one-pager-investor.md](../planning/one-pager-investor.md) ממולא  
- [ ] [use-of-funds-template.md](./use-of-funds-template.md) ממולא  
- [ ] Deck 12 → PDF לשליחה (מחוץ ל־git)

---

## F · אחרי 30 יום פיילוט

- [ ] 3 מדדים ב־[case-study-frame.md](./sales-pack/case-study-frame.md)  
- [ ] החלטת Network / עצירה  
- [ ] עדכון אתר רק עם מספרים אמיתיים / הסכמה

---

## הגדרת «סיימנו הכל»

| שכבה | סטטוס |
|------|--------|
| מוצר + www + data room + sales pack | **Done** |
| מילוי עסקי A–C | **את עושה עכשיו** |
| פיילוט חתום + מדידה D–F | **סגירה מסחרית** |

בלי D–F אפשר למכור ולגייס *שיחות* — לא *proof*. עם D–F זה 10/10 מסחרי.
