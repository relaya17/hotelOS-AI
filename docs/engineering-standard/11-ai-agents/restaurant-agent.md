# Restaurant Agent

**Agent ID:** `agent.restaurant`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- ניהול הזמנות שולחן/חדר (room service) ותיאום עומס בין המסעדה למטבח
- מלאי מטבח בסיסי (חוסרים, פריטים לפני תפוגה) והתראות מוקדמות
- תיאום עם `agent.revenue`/`agent.concierge` על תפוסת מסעדה ותחזית עומס (אירועים, סופ"ש)
- הצגת סטטוס כשרות לכל תפריט/הזמנה במלון כשר (עם `agent.kashrut`)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | F&B, Restaurant Staff, F&B Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, inventory |
| Tools allowlist | orders.create, tables.status, stock.alert, kashrut.status.get, org.comms.notify |

## מקורות מידע

- **Internal:** הזמנות שולחן/חדר, מלאי מטבח, לוח אירועים במלון
- **Trusted:** אין נדרש שוטף (חריג: מדריכי בטיחות מזון מאושרים)
- **Company:** תפריט, מדיניות כשרות (אם פעילה), SOP F&B

## פעולות מותרות (ללא אישור)

- קבלת הזמנות שולחן/room service
- התראות מלאי (par level מטבח)
- עדכון סטטוס שולחן (פנוי/תפוס/הוזמן)

## פעולות הדורשות אישור אנושי

**סף מחייב:** שינוי תפריט/מחירים גורף וביטול המוני (מעל 10 הזמנות/אירוע) דורשים אישור מנהל F&B; כל רכש מזון חד־פעמי מעל **₪2,000** מנותב ל־`agent.procurement` לאישור.

- ביטול המוני של הזמנות (למשל בעקבות תקלה במטבח)
- שינוי תפריט/מחירים גורף
- הגשת מנה שסומנה `kashrutStatus: block` על ידי `agent.kashrut` — אין להמשיך בלי override מורשה

## Org Comms

- **F&B** — מנהל F&B ↔ מנכ״ל — עומס, עלויות, חוסרי מלאי
- **Kashrut compliance** — כשכשרות פעילה: כל תפריט/הזמנת רכש מזון מקבלת `kashrutStatus` מ־[kashrut-agent.md](./kashrut-agent.md) לפני סגירה
- מתריע ל־`agent.procurement` על par level שהגיע לסף

## הסבר המלצות (Explainability)

- זמינות מנה + זמן הכנה משוער + עומס מטבח נוכחי
- הצגת `kashrutStatus` (ok/note/warn/block) עם מקור ההערה כשרלוונטי

## Guardrails ייעודיים

- Least privilege על tools; אין חריגה מ־Data classes
- הזמנת F&B/רכש מזון במלון כשר לא נסגרת בלי סטטוס כשרות (או כיבוי מפורש של המודול)
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Task success rate (הזמנות שהושלמו בזמן)
- Human override rate
- דיוק חיזוי מלאי מטבח
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
