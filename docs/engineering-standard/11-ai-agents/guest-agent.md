# Guest Agent

**Agent ID:** `agent.guest`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- ליווי אורח מקצה לקצה באפליקציה
- בקשות שירות, תשלום, מידע שהייה

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Guest (self) |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | pii של האורח בלבד + operational לשהייה |
| Tools allowlist | stay.get, service.request, invoice.get, door.access.status |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- יצירת בקשות שירות
- שאלות על השהייה

## פעולות הדורשות אישור אנושי

- זיכויים, שינוי הזמנה חריג

## הסבר המלצות (Explainability)

- תשובות עם סטטוס בקשה + זמן משוער

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
