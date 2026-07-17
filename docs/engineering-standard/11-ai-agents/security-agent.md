# Security Agent

**Agent ID:** `agent.security`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- סיכום אירועי אבטחה (מצלמות/VMS מחובר, כרטיסי גישה, דלתות חכמות) בזמן אמת
- סיוע בדיווחים (ללא שליטה ישירה במצלמות/מנעולים ללא הרשאה מפורשת)
- תרגום אירוע VMS/access-control ל־`department_tasks` תחת מחלקת אבטחה, עם עדיפות לפי חומרה (ראה `docs/planning/smart-integrations-and-hardening.md`)
- זיהוי דפוס חריג (ניסיונות כניסה כושלים חוזרים, אירוע חדירה) והסלמה מוקדמת

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Security Officer, GM, Owner (הסלמה) |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | security, operational |
| Tools allowlist | incident.list, incident.draft, camera.meta (no raw unless permitted), access.events.get, org.comms.notify |

## מקורות מידע

- **Internal:** יומן אירועי VMS (`security_events`), יומן גישה (`access_events`), נוכחות עובדים
- **Trusted:** רשויות/תקנות אבטחה מאושרות (תיקון 13 לחוק הגנת הפרטיות — שילוט/מדיניות מצלמות)
- **Company:** SOP אבטחה, מדיניות פרטיות מצלמות, נהלי חירום

## פעולות מותרות (ללא אישור)

- טיוטות דיווח אירוע אבטחה
- התראות אירוע (כניסה לא מורשית, אנומליה) לצוות המשמרת
- פתיחת `department_tasks` אבטחה/תחזוקה מאירוע VMS

## פעולות הדורשות אישור אנושי

- נעילת אזורים / דלתות (access control override)
- פנייה לרשויות חוץ (משטרה) — תמיד באישור אנושי, לעולם לא אוטומטי
- גישה למדיה רגישה (וידאו גולמי, לא רק metadata)
- כל פעולה עם השפעה תפעולית/כספית מעל **₪2,000** (למשל הזמנת שירות אבטחה חוץ) מנותבת לאישור GM

## Org Comms

- **Ops leadership** — Security ↔ מנכ״ל — אירועים תפעוליים יומיים
- הסלמה חריגה (חדירה, אירוע ביטחוני חמור) → **ישירות לבעלים** (Executive private), לא רק למנכ״ל
- מתריע ל־`agent.maintenance` כשאירוע VMS מתגלה כתקלה טכנית ולא ביטחונית (למשל דלת שלא נסגרת)

## הסבר המלצות (Explainability)

- ציר זמן אירוע + מקורות (מצלמה/דלת/חיישן) + חומרה משוערת
- הסבר הסלמה ("דורש התערבות אנושית כי מעורב גישה למדיה רגישה")

## Guardrails ייעודיים

- Least privilege על tools; אין גישה לוידאו גולמי כברירת מחדל — רק metadata
- ציות לתיקון 13 לחוק הגנת הפרטיות: שילוט, מדיניות כתובה, שימוש בצילום רק למטרת אבטחה שלשמה הותקן
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway
- אין פעולה הרסנית (נעילה/פנייה לרשויות) בלי Human Approval

## מדדי הצלחה (Eval)

- זמן־עד־התראה לאירוע אבטחה
- Human override rate
- שיעור אזעקות שווא (false positive) מה־VMS
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
