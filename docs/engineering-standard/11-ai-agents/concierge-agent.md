# Concierge Agent

**Agent ID:** `agent.concierge`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- המלצות מסעדות/אטרקציות
- מידע מקומי מאובטח

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Guest, Concierge Staff |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | company + trusted tourism/weather |
| Tools allowlist | places.recommend, weather.get, reservation.assist |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- המלצות
- טיוטת הזמנה חיצונית

## פעולות הדורשות אישור אנושי



## הסבר המלצות (Explainability)

- Citations למקורות trusted + העדפות אורח (בהסכמה)

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
