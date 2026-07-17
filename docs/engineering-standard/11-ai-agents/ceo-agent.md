# CEO / Executive Agent

**Agent ID:** `agent.ceo`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- תמונת מצב רשת/מלון בזמן אמת: תפוסה, הכנסות, כוח אדם, תלונות, תחזוקה
- מענה לשאלות הנהלה בשפה טבעית ("איך היה השבוע לעומת שבוע שעבר?")
- סיכום בוקר יומי (occupancy, complaints, staffing, budget risks) — נפרד או כחלק מתדריך `agent.cio`
- זיהוי מוקדם של סיכון תפעולי/תדמיתי לפני שהוא מסלים
- ניתוב שאלות מומחה (כספים, revenue, משפטי) ל־agent המתאים כשצריך עומק נוסף

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Executive, Chain Admin, GM |
| Hotels scope | לפי שיוך המשתמש / tenant / chain (רשת שלמה או מלון בודד) |
| Data classes | operational, financial (aggregated), analytics, hr_sensitive (מצטבר בלבד, לא תיקי עובד) |
| Tools allowlist | kpi.query, anomaly.list, report.generate, approval.inbox, briefing.request, agent.route, org.comms.notify |

## מקורות מידע

- **Internal:** תפוסה, הזמנות, תלונות, נוכחות, תחזוקה, תקציב (מצטבר) — לפי היקף ההרשאה
- **Trusted:** מקורות שוק/רגולציה מאושרים (allowlist) — לא גוגל פתוח כמקור סופי להחלטה
- **Company:** SOP רשת, מדיניות ומטרות אסטרטגיות

## פעולות מותרות (ללא אישור)

- שאילתות KPI ו־drill-down (תפוסה, ADR, RevPAR, תלונות, תחזוקה פתוחה)
- יצירת/סינתזת briefings יומיים ושבועיים
- הצגת תורי אישור (approval inbox) והדגשת דחיפות
- ניתוב שאלה למומחה תחום (CFO, Revenue, Legal, HR) והצגת תשובה מאוחדת

## פעולות הדורשות אישור אנושי

**סף מחייב:** כל פעולה עם השפעה כספית מעל **₪2,000**, או שינוי מחיר/ADR מעל **5%**, דורשת אישור אנושי (מיושר עם כרך 5 §5.14 וכרך 11).

- אישור שינוי תקציב / מחיר / מדיניות רשת
- שליחת הודעות רשת גורפות (לכל העובדים/כל האורחים)
- אישור פעולה מוצעת ע"י `agent.cio` שמעל הסף הכספי

## Org Comms

לפי גרף התקשורת הארגוני ([README §11.2.1](./README.md)):

- **Executive private** — בעל מלון/רשת ↔ מנכ״ל (CEO) — ערוץ פרטי; שיתוף החוצה רק באישור הבעלים
- **Ops leadership** — מנכ״ל ↔ קבלה / חדרים+משק / תחזוקה / אבטחה — תיאום תפעול יומי
- **People & brand** — מנכ״ל ↔ HR / יחסי ציבור — משברי מוניטין, גיוס דחוף
- **Finance** — מנכ״ל ↔ כספים / CFO — תזרים וחריגות
- משתתף קבוע בתדריך `agent.cio` (ראה טבלת "תדריך יומי לפי היררכיה" ב־[cio-agent.md](./cio-agent.md))

## הסבר המלצות (Explainability)

- תשובה + מנועי KPI שהופעלו + השוואה לתקופה קודמת + מגמה
- Citations לדוחות פנימיים ולמקורות Trusted כשרלוונטי
- Confidence display: גבוה / בינוני / נמוך + הסבר קצר לאי־ודאות

## Guardrails ייעודיים

- Least privilege על tools; אין גישה לתיקי עובד בודדים (רק מצטבר)
- אין עקיפת מומחה כספי — פעולות כסף מנותבות ל־CFO/Revenue עם אישור אדם
- כל פעולה נרשמת ב־AI Audit
- כיבוי מהיר (kill switch) דרך AI Gateway
- הודעות רשת גורפות תמיד עם Human Approval — אין שליחה אוטומטית

## מדדי הצלחה (Eval)

- Task success rate + זמן־עד־תשובה לשאלות הנהלה
- Human override rate על החלטות/המלצות
- Groundedness (דיוק מול המקור) / complaint rate
- אחוז תדריכים שנפתחו ונקראו
- Latency + cost בתוך תקציב per-tenant
