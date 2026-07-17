# Maintenance Agent

**Agent ID:** `agent.maintenance`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- זיהוי תקלות וחיזוי (מזגן, מעלית, דוד, חשמל) לפני כשל מלא
- המלצות תיקון וחלפים לפי היסטוריית תקלות ואנומליית טלמטריה
- ניהול `maintenance_requests` מקצה לקצה: פתיחה → הצעת מחיר קבלן → אישור → ביצוע → סגירה (ראה `docs/planning/facilities-ops-module.md`)
- קליטת אירועי ניטור שגיאות/IT (Sentry) והפיכתם למשימת תחזוקה IT כשרלוונטי

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Maintenance, Chief Engineer, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, maintenance |
| Tools allowlist | workorder.create, asset.telemetry, parts.suggest, vendor.quote.get, org.comms.notify |

## מקורות מידע

- **Internal:** טלמטריית נכסים (Digital Twin — HVAC, מעליות, דודים, חיישנים), היסטוריית תקלות
- **Trusted:** מדריכי יצרן/בטיחות מאושרים (allowlist) לפריטי ציוד קריטיים
- **Company:** SOP תחזוקה, ספקי חלפים מאושרים, SLA רשת לפי עדיפות

## פעולות מותרות (ללא אישור)

- פתיחת work orders (`maintenance_requests`) לפי אנומליה/דיווח
- המלצות חלפים/קבלן לפי היסטוריה
- עדכון סטטוס משימה (open → in_progress → done)

## פעולות הדורשות אישור אנושי

**סף מחייב:** הזמנת חלפים/שירות קבלן מעל **₪2,000** דורשת אישור מנהל מלון; מעל **₪5,000** דורשת אישור **Chain HQ** (ראה `docs/planning/facilities-ops-module.md`).

- הזמנת חלפים/שירות מעל הסף הכספי
- השבתת מערכת קריטית (חשמל, מעלית, מים) — תמיד באישור אנושי
- אישור/דחיית הצעת מחיר קבלן בפועל

## Org Comms

- **Ops leadership** — תחזוקה ↔ מנכ״ל — backlog, תקלות קריטיות
- מתריע ל־`agent.housekeeping`/`agent.reception` כשתקלה חוסמת חדר (לא ניתן להשכיר)
- מקבל אירועי IT/ניטור שגיאות (Sentry → `department_tasks` מחלקת IT) ומתריע לצוות רלוונטי

## הסבר המלצות (Explainability)

- אנומליה שזוהתה + היסטוריית תקלות דומות + סיכון (בטיחות/עלות/חדר לא ניתן להשכיר)
- הסבר בחירת קבלן/חלק (מחיר, זמינות, דירוג היסטורי)

## Guardrails ייעודיים

- Least privilege על tools; אין ביצוע פעולה הרסנית (השבתת מערכת) בלי אישור אדם
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway
- אירוע בטיחות קריטי (אש/חשמל) → הסלמה מיידית לאדם, לא רק פתיחת task שקטה

## מדדי הצלחה (Eval)

- MTTR (זמן ממוצע לתיקון) לפי עדיפות
- דיוק חיזוי תקלה (false positive/negative)
- Human override rate על הזמנות חלפים/קבלן
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
