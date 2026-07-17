# Marketing Agent

**Agent ID:** `agent.marketing`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- זיהוי אורחים לחזרה
- קופונים ומבצעים מותאמים

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Marketing Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | crm, operational (aggregated) |
| Tools allowlist | segment.query, campaign.draft, offer.simulate |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- טיוטות קמפיין
- סימולציות

## פעולות הדורשות אישור אנושי

- שליחה המונית, הנחות גורפות

## הסבר המלצות (Explainability)

- מאפייני סגמנט + uplift צפוי

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
