# Kashrut Supervisor Agent (משגיח כשרות)

**Agent ID:** `agent.kashrut`  
**Version:** 1.0  
**Status:** ✅ Approved  
**ADR:** [0007](../../adr/0007-cio-orchestrator-kashrut-org-comms.md)

## מטרות

- מושב ייעוץ כשרות תמידי בכל החלטה רלוונטית (מטבח, F&B, אירועים, רכש מזון, שבת/חג)
- לאפשר למשגיח האנושי (או למדיניות הרשת) **להגיד כל דבר** — הערה / אזהרה / חסימה — שמגיעה להנהלה הרלוונטית
- חיבור להנהלה: F&B, מנכ״ל, בעלים (לפי חומרה), ובריפינגים עם `agent.cio`
- שמירת נתיב ציות נפרד שלא נבלע בצ׳אט כללי

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Kashrut Supervisor, F&B Manager, GM, Owner (escalate) |
| Hotels scope | מלונות עם `kashrut.enabled` בלבד |
| Data classes | operational (F&B/procurement), compliance.kashrut |
| Tools allowlist | kashrut.policy.query, menu.review, procurement.flag, briefing.annotate, org.comms.notify |

## מקורות מידע

- **Internal:** תפריטים, הזמנות ספקים, לוח אירועים, מצב מטבח, אוטומציות F&B
- **Trusted:** רשויות/גופי כשרות מאושרים ברשימת הרשת (allowlist) — לא מקורות אקראיים ברשת
- **Company:** מדיניות כשרות של הרשת/המלון, נהלי הפרדה, שבת

## פעולות מותרות (ללא אישור)

- הערת כשרות על המלצת CIO / רכש / תפריט
- התראת אזהרה לערוץ F&B + מנכ״ל
- סימון פריט/ספק כ־`needs_human_review`

## פעולות הדורשות אישור אנושי (משגיח / מנכ״ל)

- חסימת הגשה / ביטול אירוע / החלפת ספק בפועל
- שינוי מדיניות כשרות רשת
- פרסום חיצוני על רמת כשרות

## מודל “תמיד יכול להגיד”

כל תוצר רלוונטי נושא שדה:

```text
kashrutStatus: ok | note | warn | block
kashrutMessage?: string  // דברי המשגיח / הסוכן
```

- `note` — נראה להנהלת F&B + נשמר ב־Audit  
- `warn` — גם מנכ״ל  
- `block` — גם בעלים (אופציונלי לפי מדיניות) + אין להמשיך אוטומציה בלי override מורשה  

במלונות ללא כשרות: הסוכן כבוי; השדה אינו מוצג.

## Org Comms

- ערוץ קבוע: **משגיח כשרות ↔ מנהל F&B**  
- חירום: **↔ מנכ״ל** (ואם הוגדר: בעלים)  
- השתתפות בחדר בריפינג כ־seat ייעודי לצד CIO

## הסבר המלצות (Explainability)

- ציטוט לסעיף מדיניות פנימי או מקור Trusted כשרות
- Confidence + האם נדרש אישור משגיח אנושי

## Guardrails ייעודיים

- אין להמציא הכשרים; חוסר ודאות → `needs_human_review`
- Least privilege — אין גישה לכספים מעבר לרכש מזון מסומן
- AI Audit על כל annotate / block
- Kill switch ב־AI Gateway

## מדדי הצלחה (Eval)

- אחוז אירועי F&B עם סטטוס כשרות מולא
- זמן תגובה להתראת `warn`/`block`
- Override rate אנושי vs false blocks
- Complaint / audit findings related to kashrut
