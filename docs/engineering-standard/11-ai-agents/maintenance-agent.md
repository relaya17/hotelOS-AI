# Maintenance Agent

**Agent ID:** `agent.maintenance`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- זיהוי תקלות וחיזוי (מזגן, מעלית, דוד, חשמל)
- המלצות תיקון וחלפים

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Maintenance, Chief Engineer |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, maintenance |
| Tools allowlist | workorder.create, asset.telemetry, parts.suggest |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- פתיחת work orders
- המלצות חלפים

## פעולות הדורשות אישור אנושי

- הזמנת חלפים מעל סף / השבתת מערכת קריטית

## הסבר המלצות (Explainability)

- אנומליה + היסטוריית תקלות + סיכון

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
