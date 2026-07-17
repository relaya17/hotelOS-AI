# Legal Agent

**Agent ID:** `agent.legal`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- חיפוש מדיניות משפטית פנימית
- תזכורות compliance (לא ייעוץ משפטי חיצוני)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Legal, Compliance |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | company knowledge, compliance docs |
| Tools allowlist | policy.search, dpa.checklist |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- אחזור מסמכים מאושרים

## פעולות הדורשות אישור אנושי

- שינוי ToS/Privacy

## הסבר המלצות (Explainability)

- ציטוטים מדויקים ממסמכי חברה בלבד

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
