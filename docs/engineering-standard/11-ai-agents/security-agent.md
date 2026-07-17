# Security Agent

**Agent ID:** `agent.security`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- סיכום אירועי אבטחה
- סיוע בדיווחים (ללא שליטה ישירה במצלמות ללא הרשאה)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Security Officer, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | security, operational |
| Tools allowlist | incident.list, incident.draft, camera.meta (no raw unless permitted) |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- טיוטות דיווח
- התראות אירוע

## פעולות הדורשות אישור אנושי

- נעילת אזורים, פנייה לרשויות, גישה למדיה רגישה

## הסבר המלצות (Explainability)

- ציר זמן אירוע + מקורות

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
