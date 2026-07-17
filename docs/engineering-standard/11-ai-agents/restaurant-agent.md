# Restaurant Agent

**Agent ID:** `agent.restaurant`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- ניהול הזמנות שולחן/חדר
- מלאי מטבח בסיסי

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | F&B, Restaurant Staff |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, inventory |
| Tools allowlist | orders.create, tables.status, stock.alert |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- קבלת הזמנות
- התראות מלאי

## פעולות הדורשות אישור אנושי

- ביטול המוני / שינוי תפריט מחירים

## הסבר המלצות (Explainability)

- זמינות + זמן הכנה משוער

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
