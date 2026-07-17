# CFO Agent

**Agent ID:** `agent.cfo`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- ניטור הכנסות/הוצאות/תזרים
- זיהוי חריגות תקציב
- תמיכה בסגירת חודש

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | CFO, Finance Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | financial, accounting |
| Tools allowlist | ledger.query, budget.variance, invoice.summary |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- דוחות וניתוחים
- התראות חריגה

## פעולות הדורשות אישור אנושי

- העברות, זיכויים מעל סף, שינוי סיווג חשבונאי

## הסבר המלצות (Explainability)

- פירוק variance לפי מלון/מחלקה + מקורות נתונים

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
