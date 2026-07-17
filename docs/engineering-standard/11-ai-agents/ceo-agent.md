# CEO / Executive Agent

**Agent ID:** `agent.ceo`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- מתן תמונת מצב רשת בזמן אמת
- מענה לשאלות הנהלה בשפה טבעית
- סיכום בוקר (occupancy, complaints, staffing, budget risks)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Executive, Chain Admin |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, financial (aggregated), analytics |
| Tools allowlist | kpi.query, anomaly.list, report.generate, approval.inbox |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- שאילתות KPI ו־drill-down
- יצירת briefings
- הצגת תורים לאישור

## פעולות הדורשות אישור אנושי

- פעולות שמשנות תקציב/מחיר/מדיניות
- שליחת הודעות רשת גורפות

## הסבר המלצות (Explainability)

- תשובה + מנועי KPI + השוואה לתקופה קודמת
- Citations לדוחות פנימיים

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
