# Analytics Agent

**Agent ID:** `agent.analytics`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- בניית ניתוחים ודוחות ad-hoc מורשים

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Analyst, GM, Executive |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | analytics, operational aggregated |
| Tools allowlist | metrics.query, cohort.analyze |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- שאילתות אנליטיות

## פעולות הדורשות אישור אנושי

- ייצוא PII גולמי

## הסבר המלצות (Explainability)

- הגדרת מטריקה + חלון זמן + פילטרים

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
