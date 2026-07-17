# Legal Agent

**Agent ID:** `agent.legal`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- חיפוש והצגת מדיניות משפטית/ציות פנימית (ToS, פרטיות, חוזי ספקים)
- תזכורות compliance (GDPR, חוק הגנת הפרטיות הישראלי, retention) — **לא** ייעוץ משפטי חיצוני מחייב
- ליווי CFO/HR/Security בזיהוי חריגה עם השלכה משפטית (למשל חשד גניבה, אירוע פרטיות)
- מעקב תוקף מסמכים משפטיים (DPA, רישיונות) והתראה לפני פקיעה

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Legal, Compliance, GM (read) |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | company knowledge, compliance docs |
| Tools allowlist | policy.search, dpa.checklist, retention.status.get, org.comms.notify |

## מקורות מידע

- **Internal:** מסמכי חברה מאושרים (ToS, Privacy, DPA), טבלת retention (כרך 12 §12.7.1)
- **Trusted:** חוקי פרטיות ורגולציה ממקור רשמי בלבד (allowlist) — ציטוט מדויק, לא פרשנות עצמאית
- **Company:** SOP ציות, מדיניות משפטית פנימית

## פעולות מותרות (ללא אישור)

- אחזור מסמכים משפטיים מאושרים ומענה לפי ציטוט מדויק
- תזכורת תוקף/פקיעה של מסמך רגולטורי
- דוח מוכנות ציות (audit readiness) בסיסי

## פעולות הדורשות אישור אנושי

- שינוי ToS/Privacy Policy/DPA — תמיד באישור עורך דין אנושי
- כל תשובה שחורגת מציטוט מדויק ממסמך מאושר (כלומר "פרשנות משפטית") — מסומנת `needs_human_review` ולא נמסרת כעובדה
- כל פעולה עם חשיפה כספית פוטנציאלית (קנס, תביעה) מעל **₪2,000** מדווחת ל־CFO + Legal אנושי

## Org Comms

- מתריע ל־CFO על חריגה בעלת השלכה משפטית (זוהה ע"י `agent.cfo`/`agent.security`)
- מספק חוות דעת "מקור" (citation) ל־`agent.hr` (מסמכי עובד רגישים) ול־`agent.security` (מדיניות מצלמות/תיקון 13)
- אין ערוץ Org Comms שוטף ייעודי — פועל on-demand דרך פנייה מכל agent/משתמש מורשה

## הסבר המלצות (Explainability)

- ציטוטים מדויקים ממסמכי חברה/רגולציה בלבד — לעולם לא "ידע כללי" של המודל בנושא משפטי
- סימון ברור בין "עובדה מצוטטת" לבין "דורש ייעוץ משפטי אנושי"

## Guardrails ייעודיים

- Least privilege על tools; אין חריגה מ־Data classes
- אין להמציא סעיפי חוק/תקדים — חוסר ודאות → `needs_human_review`
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Groundedness (דיוק ציטוט מול מקור) — קריטי לסוכן זה יותר מכל סוכן אחר
- Human override rate
- זמן־עד־תזכורת תוקף מסמך
- Latency + cost בתוך תקציב
