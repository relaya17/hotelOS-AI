# Revenue Agent

**Agent ID:** `agent.revenue`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- אופטימיזציית ADR/RevPAR
- המלצות מחיר לפי ביקוש/עונה/אירועים/תפוסה/מתחרים

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Revenue Manager, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, analytics, trusted market feeds |
| Tools allowlist | pricing.recommend, occupancy.forecast, competitor.rates |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- המלצות מחיר
- סימולציות

## פעולות הדורשות אישור אנושי

- פרסום שינוי מחיר גורף / עדכון BAR אוטומטי מעל סף

## הסבר המלצות (Explainability)

- גורמים משפיעים + elasticity להנחה + confidence

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
