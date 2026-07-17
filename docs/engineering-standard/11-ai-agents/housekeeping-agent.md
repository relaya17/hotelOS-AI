# Housekeeping Agent

**Agent ID:** `agent.housekeeping`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- תעדוף ניקוי חדרים לפי checkout, VIP, DND, ומרחק עובד
- שיבוץ עובד הזמין/הקרוב ביותר למשימה, מאוזן עומס בין הצוות
- הערכת זמן ניקוי + AI Quality Check (בדיקת תמונות לפני/אחרי)
- הזנת סטטוס `department_tasks`/`maintenance_requests` תחת מחלקת משק בית (ראה `docs/planning/facilities-ops-module.md`)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | HK Supervisor, HK Staff, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational |
| Tools allowlist | rooms.dirty.list, staff.location, task.assign, quality.score, org.comms.notify |

## מקורות מידע

- **Internal:** מצב חדרים (Digital Twin), נוכחות עובדים, checkout/checkin, בקשות DND/VIP
- **Trusted:** אין צורך במקור חיצוני שוטף למחלקה זו (חריג: מדריכי בטיחות/ניקוי כימיקלים מאושרים אם רלוונטי)
- **Company:** SOP ניקיון, SLA רשת לחדר VIP/checkout

## פעולות מותרות (ללא אישור)

- יצירת/שיבוץ משימות ניקוי בגבול מדיניות SLA
- התראות עיכוב/חריגת SLA לאחראי משמרת
- ציון איכות (Quality Check) אוטומטי מתמונות

## פעולות הדורשות אישור אנושי

- דחיית חדר VIP בתעדוף (למשל בגלל עומס) — דורש אישור מפקח
- שינוי SLA רשת (למשל "זמן מקסימלי לניקוי checkout")
- כל הזמנת ציוד/כימיקלים מעל **₪2,000** מנותבת ל־`agent.procurement` לאישור (ראה שם)

## Org Comms

- **Ops leadership** — מפקח HK ↔ מנכ״ל/Front Office — עדכון סטטוס חדרים לצ׳ק־אין
- מתריע לצוות תחזוקה (`agent.maintenance`) כשמתגלה תקלה בזמן ניקוי (למשל מזגן תקול)
- מזין KPI ל־`agent.cio` בסעיף "חדרים / משק בית" בתדריך היומי

## הסבר המלצות (Explainability)

- למה חדר X קודם על חדר Y (checkout time, VIP flag, DND, מרחק עובד, SLA שנותר)
- ציון איכות עם הסבר קצר (למשל "זוהה אבק גלוי בתמונה 2")

## Guardrails ייעודיים

- Least privilege על tools; אין גישה לפרטי תשלום/PII אורח
- אין שיבוץ עובד שחרג משעות עבודה מותרות בלי אישור מפקח
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- זמן ניקוי בפועל מול הערכה
- אחוז חדרים שעברו SLA
- Human override rate על שיבוצים
- דיוק Quality Check מול בדיקה אנושית (false positive/negative)
- Latency + cost בתוך תקציב
