# Must-have growth — MVP pack (2026-08-03)

ארבעת פריטי ה"חובה" הראשונים — מימוש דטרמיניסטי / HITL, בלי כתיבה אוטומטית ל־PMS.

| פריט | סטטוס | נקודת כניסה |
|------|--------|-------------|
| Reputation AI | ✅ | `POST /v1/public/reputation/ingest/:provider` · Executive ops card |
| Upsell AI | ✅ | Guest stay hub · Admin booking panel · `/v1/ops/upsells` |
| Incident Center | ✅ | Executive nav «מרכז אירועים» · `GET /v1/ops/incidents` |
| Revenue + Forecast | ✅ | CIO digest · `GET /v1/ops/forecast` · revenue suggestions HITL |

עדיין מחוץ לסקופ: Predictive Maintenance IoT, Energy Management, PMS rate writeback.

---

## 1. Reputation AI

- טבלה `reputation_reviews` (מקורות: google / booking / tripadvisor / generic)
- סיווג סנטימנט דטרמיניסטי (דירוג + מילות מפתח HE/EN)
- ביקורת ≤3★ או negative → `department_tasks` במחלקת `front_office` (`reputation_review`)
- סוד: `REPUTATION_INGEST_SECRET`

## 2. Upsell AI

- טבלה `upsell_offers`
- כללים: late checkout / spa / dinner / room upgrade לפי סטטוס שהייה
- Guest: סעיף «הצעות לשדרוג» (לא ב־hero)
- Admin: «הצע upsells» + accept/decline
- אופציונלי: העשרת טקסט דרך `agent.guest` ב־Gateway

## 3. Incident Center

- אגרגציה מ־`department_tasks` (security / IT / maintenance) + maintenance_requests דחופים
- בלי טבלאות חדשות
- UI משותף ב־`@hotelos/features` · Executive + Admin

## 4. Revenue Optimization + Forecast

### Revenue (HITL)
| Occupancy | Suggestion |
|-----------|------------|
| ≥ 80% | +5% … +12% |
| < 30% | promo −5% |
| 30–79% | hold 0% |

טבלה `revenue_suggestions` · Approve/Reject דורש `canDecideOpsHitl` · **אין** כתיבה ל־PMS.

### Forecast (7 ימים)
- `build-ops-forecast.ts` — הגעות/עזיבות, תפוסה, תחזוקה פתוחה, רמז כוח אדם
- מוצג ב־CIO digest + כרטיס ב־ops dashboard
- `GET /v1/ops/forecast?hotelId=`

## Demo מהיר

1. **Reputation** — `curl` ל־`/v1/public/reputation/ingest/google` עם `REPUTATION_INGEST_SECRET` → כרטיס ביקורות שליליות ב־Executive
2. **Upsell** — Admin «הצע upsells» על הזמנה → Guest חיפוש שהייה
3. **Incidents** — Executive → מרכז אירועים (אחרי VMS/Sentry/anomaly)
4. **Revenue/Forecast** — CIO digest → צור הצעות תמחור + תחזית 7 ימים
