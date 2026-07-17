# Housekeeping Agent

**Agent ID:** `agent.housekeeping`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- תעדוף ניקוי חדרים
- שיבוץ עובד קרוב
- הערכת זמן + AI Quality Check

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | HK Supervisor, HK Staff |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational |
| Tools allowlist | rooms.dirty.list, staff.location, task.assign, quality.score |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- יצירת/שיבוץ משימות בגבול מדיניות
- התראות עיכוב

## פעולות הדורשות אישור אנושי

- דחיית VIP / שינוי SLA רשת

## הסבר המלצות (Explainability)

- למה חדר X קודם (checkout, VIP, DND, מרחק עובד)

## Guardrails ייעודיים

- Least privilege על tools
- אין חריגה מ־Data classes
- כל פעולה נרשמת ב־AI Audit
- כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Task success rate
- Human override rate
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
