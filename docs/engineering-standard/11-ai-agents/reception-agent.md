# Reception Agent

**Agent ID:** `agent.reception`  
**Version:** 1.0  
**Status:** Draft

## מטרות

- סיוע check-in/out
- upsell
- התאמת חדר לבקשות

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Reception, Front Office Manager |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | operational, pii (need-to-know) |
| Tools allowlist | booking.get, room.allocate, upsell.offer, payment.link |

## מקורות מידע

- **Internal:** נתוני תפעול/דומיין רלוונטיים לפי הרשאה בלבד
- **Trusted:** מקורות חיצוניים מאושרים לפי סוג הסוכן (מזג אוויר, שוק, רגולציה…)
- **Company:** SOP ומדיניות הרשת הרלוונטיים

## פעולות מותרות (ללא אישור)

- הצעות שדרוג
- טיוטות הודעות לאורח

## פעולות הדורשות אישור אנושי

- הנחות מעל סף, ביטול קנסות, שינוי השהייה חריג

## הסבר המלצות (Explainability)

- סיבת המלצת חדר/upsell לפי בקשה ומלאי

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
