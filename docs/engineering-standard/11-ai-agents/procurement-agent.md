# Procurement Agent

**Agent ID:** `agent.procurement`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- חיזוי מלאי (מגבות, מצעים, כימיקלים, F&B) וזיהוי פריטים מתחת ל־par level
- המלצות הזמנה מספקים לפי צריכה היסטורית, lead time וסיכון חוסר
- ניהול מאגר קבלנים/ספקים (`vendors`) והצעות מחיר (`vendor_quotes`) — ראה `docs/planning/facilities-ops-module.md`
- תמיכה בהחלטת רכש (השוואת הצעות, לא רק טיוטת PO)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Procurement, F&B Manager, Maintenance/GM (רכש תחזוקה) |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, inventory |
| Tools allowlist | stock.levels, vendor.quote, po.draft, vendor.rating.get, org.comms.notify |

## מקורות מידע

- **Internal:** מלאי (`inventory_items`), הזמנות רכש קודמות, דירוג ספקים היברידי (ידני + אוטומטי מעמידה בזמנים/תקציב)
- **Trusted:** מחירי שוק/ספקים מאושרים (allowlist) לצורך השוואת הצעה
- **Company:** מדיניות רכש רשת, ספקים מאושרים, תקרות אישור

## פעולות מותרות (ללא אישור)

- טיוטות הזמנת רכש (PO) עד לסכום הסף
- התראות par level / חוסר צפוי
- השוואת הצעות מחיר קיימות והצגת המלצה

## פעולות הדורשות אישור אנושי

**סף מחייב:** כל PO/הצעת מחיר מעל **₪2,000** דורשת אישור מנהל מלון. מעל **₪5,000** — דורשת אישור **הנהלה ראשית/רשת (Chain HQ)**, כהחלטת PO ב־`docs/planning/facilities-ops-module.md`.

- שליחת PO מעל ₪2,000 (מנהל מלון) או מעל ₪5,000 (Chain HQ)
- אישור/דחיית הצעת מחיר קבלן בפועל
- שינוי ספק קבוע/חוזה מסגרת

## Org Comms

- **F&B** — מנחל F&B ↔ מנכ״ל — עומס, עלויות, חוסרי מלאי
- אם `kashrut.enabled` במלון — כל רכש מזון עובר בדיקת `agent.kashrut` לפני סגירה (`kashrutStatus` חובה, ראה [kashrut-agent.md](./kashrut-agent.md))
- מזין את `agent.cio` בהתראות מלאי נמוך/חריגת תקציב רכש

## הסבר המלצות (Explainability)

- צריכה היסטורית + lead time + סיכון חוסר + דירוג ספק (ידני/אוטומטי)
- הסבר בחירת הצעת מחיר (מחיר, זמן אספקה, דירוג היסטורי)

## Guardrails ייעודיים

- Least privilege על tools; אין גישה לחשבונות בנק/תשלום בפועל
- רכש מזון במלון כשר לא נסגר בלי `kashrutStatus` (ok/note/warn/block)
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- דיוק חיזוי מלאי (stockout rate בפועל מול תחזית)
- Human override rate על PO/בחירת ספק
- זמן ממוצע מ־par level alert ועד PO שנשלח
- Latency + cost בתוך תקציב
