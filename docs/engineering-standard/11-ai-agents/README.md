# כרך 11 — AI Agents

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** AI Platform Lead + Domain Owners

---

## 11.1 מדיניות

לא Agent אחד גנרי — אלא סוכנים ייעודיים עם הרשאות, כלים ואישורי אדם מוגדרים.

**בחזית המוצר** יכול להופיע יועץ־על אחד (`agent.cio`) שמתזמר את המומחים. מאחורי הקלעים נשארים least privilege, Trusted Knowledge, ו־Human approval.

כל Agent מתועד בקובץ נפרד לפי התבנית ב־[00-AGENT-TEMPLATE.md](./00-AGENT-TEMPLATE.md).  
ארכיטקטורה: [ADR 0007](../../adr/0007-cio-orchestrator-kashrut-org-comms.md).

## 11.2 קטלוג סוכנים (v1)

| Agent | קובץ | עדיפות Roadmap |
|-------|------|----------------|
| **CIO Orchestrator** (יועץ־על) | [cio-agent.md](./cio-agent.md) | P6 |
| CEO / Executive Agent | [ceo-agent.md](./ceo-agent.md) | P5–P6 |
| CFO Agent | [cfo-agent.md](./cfo-agent.md) | P6 |
| **Kashrut Supervisor** (משגיח כשרות) | [kashrut-agent.md](./kashrut-agent.md) | P6–P7 |
| Revenue Agent | [revenue-agent.md](./revenue-agent.md) | P6 |
| Housekeeping Agent | [housekeeping-agent.md](./housekeeping-agent.md) | P5 |
| Reception Agent | [reception-agent.md](./reception-agent.md) | P5 |
| HR Agent | [hr-agent.md](./hr-agent.md) | P7 |
| Procurement Agent | [procurement-agent.md](./procurement-agent.md) | P7 |
| Marketing Agent | [marketing-agent.md](./marketing-agent.md) | P6 |
| Guest Agent | [guest-agent.md](./guest-agent.md) | P5 |
| Concierge Agent | [concierge-agent.md](./concierge-agent.md) | P5 |
| Restaurant Agent | [restaurant-agent.md](./restaurant-agent.md) | P6 |
| Spa Agent | [spa-agent.md](./spa-agent.md) | P7 |
| Security Agent | [security-agent.md](./security-agent.md) | P6 |
| Maintenance Agent | [maintenance-agent.md](./maintenance-agent.md) | P5 |
| Legal Agent | [legal-agent.md](./legal-agent.md) | P7 |
| Analytics Agent | [analytics-agent.md](./analytics-agent.md) | P6 |
| Sales Agent | [sales-agent.md](./sales-agent.md) | P6 |
| Correspondence Agent (מכתבים/הזמנות/נאומים) | [correspondence-agent.md](./correspondence-agent.md) | P5–P6 |

## 11.2.1 Org Comms — ערוצים ישירים בהיררכיה

גרף תקשורת ארגוני (בנוסף לצ׳אט עובדים הכללי), לשימוש תדריכים והתראות CIO/Kashrut:

| ערוץ | משתתפים | הערות |
|------|----------|--------|
| Executive private | בעל מלון/רשת ↔ מנכ״ל | פרטי; שיתוף החוצה רק באישור |
| Ops leadership | מנכ״ל ↔ קבלה / חדרים+משק / תחזוקה / אבטחה | תפעול יומי |
| People & brand | מנכ״ל ↔ HR / יחסי ציבור | גיוס, משבר מוניטין |
| F&B | מנכ״ל ↔ מנהל מזון ומשקאות | עומס, עלויות |
| Kashrut compliance | משגיח כשרות ↔ F&B (+ מנכ״ל ב־warn/block) | רק כשכשרות פעילה |
| Finance | מנכ״ל ↔ כספים / CFO | תזרים וחריגות |

תדריך יומי לכל תפקיד — ראו טבלה ב־[cio-agent.md](./cio-agent.md).

## 11.3 שדות חובה לכל Agent

1. מטרות  
2. הרשאות  
3. מקורות מידע  
4. פעולות מותרות  
5. פעולות הדורשות אישור אנושי  
6. כיצד מסביר המלצות  

## 11.4 כללים חוצים

- כל Agent עובר רק דרך AI Gateway
- Least privilege על Tools + DataClass
- Explainability + Audit חובה
- עדכון יכולות דרך versioned config + Knowledge approval — כולל סנכרון למובייל
- עובדות חיצוניות ל־CIO: **Trusted allowlist + citations** (גילוי ברשת מותנה באישור Knowledge)
- במלון כשר: המלצות F&B/רכש מזון לא נסגרות בלי `kashrutStatus` מ־`agent.kashrut` (או כיבוי מפורש של המודול)

## 11.5 קריטריוני אישור כרך 11

- [x] תבנית Agent מאושרת
- [x] קטלוג v1 מאושר (כולל CIO + Kashrut)
- [x] לפחות Agents של P5 מוגדרים לעומק לפני מימוש — **כל 19 הסוכנים** (17 + CIO + Kashrut) מוגדרים לעומק מלא (סעיף 11.3) בגרסה זו
- [x] Org Comms graph מוגדר לכל tenant demo
- [x] סף כספי מחייב לאישור אנושי: ₪2,000 / 5% ADR (מיושר עם כרך 5)

> אושר על ידי Product Owner ב־2026-07-18 (19 סוכנים מקוריים).

## 11.6 תוספות לאחר האישור

| תאריך | מה נוסף | סטטוס |
|-------|---------|--------|
| 2026-07-19 | Correspondence Agent — ניסוח מכתבים/הזמנות/נאומים, ראה [correspondence-agent.md](./correspondence-agent.md) | ✅ Approved + MVP בקוד (`/v1/correspondence`) |
