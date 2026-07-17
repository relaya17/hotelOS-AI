# PRD — HotelOS AI v1 (Intelligence Layer)

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Product Owner

## Problem

רשתות מלונות מפעילות מערכות מפוצלות (PMS, כספים, נוכחות, כשרות, יח״צ) בלי שכבת אינטליגנציה אחת שמחברת תפעול, כסף, ציות והחלטות הנהלה.

## Goals

1. שלוש אפליקציות נפרדות: Executive (רשת), Admin (מלון), Guest (אורח) + API משותף
2. Trust: חוק, עוגיות, תשלומים, חתימה, WebAuthn, OAuth, נוכחות
3. Turbo OS: בריפינגים, הנה״ח, צ׳אט, אוטומציות, קול, i18n
4. יועץ־על CIO + משגיח כשרות + Org Comms + Trusted Knowledge (ADR 0007)
5. תפעול מהיר: סטטוס חדר, צ׳ק־אין/אאוט, stay hub לאורח

## Non-Goals (v1)

- AI Gateway / LLM production (דטרמיניסטי לפי שעה; LLM בשלב הבא)
- PMS חיצוני מלא (connectors מתוכננים)
- אפליקציות מובייל native נפרדות (PWA מספיק ל־v1)

## Personas & User Stories

| Persona | Story |
|---------|--------|
| בעל רשת | רואה תדריך CIO יומי + חריגות כספיות/כשרות |
| מנכ״ל מלון | מגדל בקרה + Org Comms למחלקות |
| מנהל תפעול | משנה סטטוס חדר / צ׳ק־אין בלחיצה |
| משגיח כשרות | מוסיף note/warn/block על יעד F&B |
| עובד | חותם נוכחות מהטלפון (מצב מהיר) |
| אורח | מוצא שהייה, צ׳ק־אין דיגיטלי, בקשת שירות, חשבון משוער |

## Success Metrics

- Login + ops path עובד בדמו בלי שגיאות API
- Typecheck/CI ירוק
- תדריך CIO לכל role מחזיר תוכן בעברית
- מלון עם `kashrut_enabled` מציג הערות כשרות

## Dependencies

Engineering Standard v1.0 · ADR 0001–0007 · planning modules
