# Procurement Agent

**Agent ID:** `agent.procurement`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- חיזוי מלאי
- המלצות הזמנה מספקים

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Procurement, F&B Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, inventory |
| Tools allowlist | stock.levels, vendor.quote, po.draft |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- טיוטות הזמנת רכש
- התראות par level

## פעולות הדורשות אישור אנושי

- שליחת PO מעל סכום

## הסבר המלצות (Explainability)

- צריכה היסטורית + lead time + סיכון חוסר

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
