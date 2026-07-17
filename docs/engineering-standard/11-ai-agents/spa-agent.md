# Spa Agent

**Agent ID:** `agent.spa`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- תיאום טיפולי SPA
- upsell חבילות

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Spa Staff, Guest |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, pii מוגבל |
| Tools allowlist | spa.availability, spa.book |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- הזמנת טיפולים

## פעולות הדורשות אישור אנושי

- החזרים מעל סף

## הסבר המלצות (Explainability)

- התאמה להעדפות + זמינות מטפלים

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
