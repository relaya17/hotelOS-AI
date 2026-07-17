# Marketing Agent

**Agent ID:** `agent.marketing`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- זיהוי אורחים לחזרה (win-back) וסגמנטציה לפי היסטוריית שהייה
- קופונים ומבצעים מותאמים לפי סגמנט/עונתיות
- תמיכה בקמפיינים לפי תוצאות `agent.analytics` ו־`agent.revenue` (תיאום תפוסה/מחיר)
- ניהול סנטימנט ביקורות/מוניטין ברמת בסיס (זיהוי מגמה, לא מענה אוטומטי לביקורת ציבורית)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Marketing Manager, GM, Chain Marketing |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | crm, operational (aggregated) |
| Tools allowlist | segment.query, campaign.draft, offer.simulate, review.sentiment, org.comms.notify |

## מקורות מידע

- **Internal:** CRM, היסטוריית שהייה/הזמנות (מצטבר), פידבק אורחים (`guest_feedback`)
- **Trusted:** מקורות שוק/תיירות מאושרים (allowlist) לבנצ'מרק קמפיינים
- **Company:** מדיניות מותג, SOP קמפיינים, תקציב שיווק

## פעולות מותרות (ללא אישור)

- טיוטות קמפיין (תוכן, סגמנט מטרה, תזמון)
- סימולציות תגובה צפויה (uplift משוער)
- ניתוח סנטימנט וזיהוי מגמת ביקורות

## פעולות הדורשות אישור אנושי

**סף מחייב:** קמפיין/הנחה עם עלות משוערת מעל **₪2,000** דורש אישור; הנחה גורפת מעל **5%** ממחיר הבסיס דורשת אישור GM/Revenue.

- שליחה המונית (SMS/מייל/push) לכל בסיס האורחים
- הנחות גורפות מעל 5% ממחיר הבסיס
- מבצע שמשפיע על תמחור — מתואם ומאושר גם דרך `agent.revenue`

## Org Comms

- **People & brand** — Marketing ↔ מנכ״ל — מגמת ביקורות, משבר מוניטין, הזדמנות מדיה
- מתאם עם `agent.revenue` לפני קמפיין שמשפיע על תמחור/תפוסה
- מזין את `agent.cio` בסעיף "יחסי ציבור" (ביקורות שליליות, משברים, הזדמנויות)

## הסבר המלצות (Explainability)

- מאפייני סגמנט + uplift צפוי + עלות משוערת
- הסבר מגמת סנטימנט (אילו קטגוריות פידבק עלו/ירדו)

## Guardrails ייעודיים

- Least privilege על tools; אין ייצוא PII גולמי של אורחים
- אין תגובה ציבורית אוטומטית לביקורות — Suggest בלבד לאדם
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Uplift בפועל מקמפיין מול תחזית
- Human override rate על טיוטות קמפיין
- דיוק ניתוח סנטימנט מול בדיקה אנושית
- Latency + cost בתוך תקציב
