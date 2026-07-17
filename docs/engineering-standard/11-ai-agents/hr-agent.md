# HR Agent

**Agent ID:** `agent.hr`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- מענה על נהלי HR
- תמיכה בשיבוץ משמרות (ללא חשיפת יתר)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | HR, Department Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | hr_sensitive (מוגבל), company knowledge |
| Tools allowlist | policy.search, schedule.suggest |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- חיפוש SOP/HR
- הצעות שיבוץ

## פעולות הדורשות אישור אנושי

- שינוי חוזה/שכר/סיום העסקה

## הסבר המלצות (Explainability)

- ציטוט מדיניות חברה

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
