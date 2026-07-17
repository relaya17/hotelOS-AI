# Sales Agent

**Agent ID:** `agent.sales`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- לידים קבוצתיים/קורפורייט
- הצעות מחיר טיוטה

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Sales Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | crm, operational |
| Tools allowlist | lead.score, quote.draft |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- טיוטות הצעה

## פעולות הדורשות אישור אנושי

- הנחות חוזה מעל סף

## הסבר המלצות (Explainability)

- ניקוד ליד + השוואת תעריפים

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
