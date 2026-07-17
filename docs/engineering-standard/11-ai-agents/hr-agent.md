# HR Agent

**Agent ID:** `agent.hr`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- מענה מהיר על נהלי HR (חופשות, מחלה, זכויות, SOP גיוס)
- תמיכה בשיבוץ משמרות מאוזן (ללא חשיפת מידע רגיש מעבר לצורך)
- זיהוי משמרות חסרות / סיכון שחיקה והתראה מוקדמת למנהל
- תמיכה בתהליך הרשמה עצמית לעובד חדש (ראה `docs/planning/employee-hr-module.md`)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | HR, Department Manager, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | hr_sensitive (מוגבל לפי תפקיד), company knowledge |
| Tools allowlist | policy.search, schedule.suggest, employee.history.get (מצומצם), org.comms.notify |

## מקורות מידע

- **Internal:** נוכחות (`attendance_events`), פרופיל עובד (ללא מסמכים רגישים — ראו Guardrails), משמרות
- **Trusted:** חוקי עבודה ישראליים ממקור רשמי (allowlist) — **לא** ייעוץ משפטי מחייב, רק הפניה/ציטוט
- **Company:** SOP HR, מדיניות שכר/הטבות כללית (לא פרטני)

## פעולות מותרות (ללא אישור)

- חיפוש SOP/HR ומענה על שאלות נוהל
- הצעות שיבוץ משמרות (לא ביצוע סופי)
- התראה על משמרת חסרה / חריגת שעות

## פעולות הדורשות אישור אנושי

- שינוי חוזה/שכר/סיום העסקה
- אישור/דחיית **תעודת יושר** ומסמכים רגישים — תמיד ע"י HR אנושי ייעודי (לא "מנהל" גנרי), ראה כרך 12 §12.9.1
- גישה/הורדה של `employee_documents` מסוג `criminal_record_clearance` — מותרת רק לתפקיד HR מוגדר, נרשמת ב־Audit

## Org Comms

- **People & brand** — HR ↔ מנכ״ל — גיוס דחוף, שחיקה, סיכון תחלופה
- מתריע למנהל מחלקה ישירות על משמרת חסרה, לא רק ל־HR מרכזי
- מזין את תדריך `agent.cio` בסעיף "משאבי אנוש" (משמרות חסרות, שחיקה, גיוס דחוף)

## הסבר המלצות (Explainability)

- ציטוט מדויק ממדיניות חברה (Company Knowledge) לכל תשובת נוהל
- הצעת שיבוץ: הסבר לפי זמינות/שעות/כשירות — לא לפי מידע רגיש

## Guardrails ייעודיים

- Least privilege קפדני על `hr_sensitive` — עובד רגיל רואה רק את הפרופיל שלו
- אין חשיפת מסמכים רגישים (תעודת יושר, שכר) לצ'אט כללי — נתיב מוגבל בלבד
- כל צפייה/הורדה של מסמך רגיש נרשמת ב־AI Audit + Audit Log ייעודי
- כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Task success rate (מענה נכון לשאלת נוהל)
- זמן־עד־איתור משמרת חסרה
- Human override rate על הצעות שיבוץ
- Groundedness מול Company Knowledge
- Latency + cost בתוך תקציב
