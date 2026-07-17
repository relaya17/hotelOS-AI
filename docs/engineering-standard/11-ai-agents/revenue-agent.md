# Revenue Agent

**Agent ID:** `agent.revenue`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- אופטימיזציית ADR/RevPAR לפי ביקוש, עונתיות, אירועים, תפוסה ומתחרים
- המלצות מחיר יומיות/שבועיות לכל מלון, עם סימולציה לפני ביצוע (ראה 5A.10)
- זיהוי הזדמנויות pickup / סיכון ביטולים
- תמיכה ב־Revenue Manager בקבלת החלטות תמחור מבוססות נתונים, לא החלפתו

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Revenue Manager, GM, Chain Revenue Director |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, analytics, trusted market feeds |
| Tools allowlist | pricing.recommend, occupancy.forecast, competitor.rates, simulator.run, approval.inbox, org.comms.notify |

## מקורות מידע

- **Internal:** תפוסה, pace, ADR היסטורי, ביטולים, אירועים במלון
- **Trusted:** נתוני שוק מלונאות מוסמכים, תעריפי מתחרים ממקור מאושר (allowlist) — לא scraping חופשי לא מאומת
- **Company:** מדיניות תמחור רשת, BAR floors/ceilings, מבצעים מאושרים

## פעולות מותרות (ללא אישור)

- המלצות מחיר לחדר/תאריך/סגמנט
- סימולציות "מה אם" דרך AI Simulator (ללא ביצוע)
- זיהוי הזדמנות/סיכון pickup והצגתה למנהל

## פעולות הדורשות אישור אנושי

**סף מחייב:** כל שינוי מחיר/BAR שמייצג שינוי ADR מעל **5%**, וכן כל פעולה בעלת השפעה כספית מעל **₪2,000** (למשל מבצע רב־חדרים), דורש אישור אנושי לפני ביצוע.

- פרסום שינוי מחיר גורף (כל המלון/כל התאריכים)
- עדכון BAR אוטומטי מעל סף 5%
- הפעלת מבצע/פרומו חדש

## Org Comms

- **F&B / Finance channels** — שיתוף תחזית עומס עם F&B (משפיע על מלאי/כוח אדם) ועם CFO (השפעה על תזרים)
- מזין את תדריך `agent.cio` בסעיף "כספים"/"בעל מלון" (pace, ADR, pickup) — ראה [cio-agent.md](./cio-agent.md)
- מתריע ל־GM/מנכ״ל על ירידת תפוסה חריגה או תמחור מתחת למתחרים בטווח משמעותי

## הסבר המלצות (Explainability)

- גורמים משפיעים (עונה, אירוע, תפוסה, מתחרים) + elasticity משוער להנחה + confidence
- Simulator: תרחיש בסיס מול תרחיש מוצע + טווחי ביטחון + סיכונים (תפוסה↓, ADR↑, ביטולים)
- Citations למקור נתון שוק חיצוני

## Guardrails ייעודיים

- Least privilege על tools; אין גישה לנתוני PII אורח מעבר לצורך
- Simulator **לא מבצע שינוי** — מדמה בלבד עד Approval אנושי מפורש
- אין נעילת מקור מחיר מתחרים יחיד בלי fallback
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Uplift בפועל מול תחזית (RevPAR/ADR)
- Human override rate על המלצות מחיר
- Groundedness מול נתוני שוק Trusted
- Latency + cost בתוך תקציב
