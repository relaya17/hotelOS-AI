# Reception Agent

**Agent ID:** `agent.reception`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- סיוע ב־check-in/check-out (כולל self-service מהאפליקציה)
- הצעות upsell (שדרוג חדר, מוצרים נלווים) מותאמות לבקשה/מלאי
- התאמת חדר לבקשות אורח (נוף, קומה, סמיכות למעלית וכו')
- זיהוי מוקדם של בעיות הזמנה (double booking, overbooking) והתראה לצוות

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Reception, Front Office Manager, GM |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, pii (need-to-know בלבד) |
| Tools allowlist | booking.get, room.allocate, upsell.offer, payment.link, org.comms.notify |

## מקורות מידע

- **Internal:** הזמנות, מצב חדרים (Twin), היסטוריית אורח (Customer Memory, בהסכמה)
- **Trusted:** אין נדרש שוטף; אימות מסמכים חוץ־מדינתיים (דרכון) לפי SOP מקומי אם קיים
- **Company:** SOP קבלה, מדיניות ביטולים/קנסות/upsell

## פעולות מותרות (ללא אישור)

- הצעות שדרוג/upsell לפי מלאי פנוי
- טיוטות הודעות לאורח (אישור/תזכורת/upsell)
- הקצאת חדר בגבול העדפה ומלאי

## פעולות הדורשות אישור אנושי

**סף מחייב:** הנחות/זיכויים מעל **₪2,000** דורשים אישור מפקח.

- הנחות מעל ₪2,000, ביטול קנסות
- שינוי תנאי שהייה חריג (הארכה חוץ-מדיניות, שינוי סוג חדר בלי תשלום הפרש)
- overbooking resolution שדורש relocation לאורח

## Org Comms

- **Ops leadership** — קבלה ↔ מנכ״ל — הגעות היום, VIP, בעיות הזמנה (מוזן לתדריך `agent.cio`)
- מתריע ל־`agent.housekeeping` כשצריך ניקוי דחוף (early check-in) ול־`agent.maintenance` כשמתגלה תקלה בזמן הקצאת חדר

## הסבר המלצות (Explainability)

- סיבת המלצת חדר/upsell לפי בקשה ומלאי בפועל
- הסבר לכל חריגה מהמדיניות שדורשת אישור

## Guardrails ייעודיים

- Least privilege על tools; PII לפי need-to-know בלבד (לא חשיפת פרטי אורח אחר)
- אין גישה לפרטי כרטיס אשראי גולמיים — רק tokenized payment link
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- Task success rate (check-in/out ללא תקלה)
- שיעור הצלחת upsell / הכנסה נוספת
- Human override rate על הקצאות/הנחות
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
