# Must-have growth — MVP pack (2026-08-03)

ארבעת פריטי ה"חובה" הראשונים — מימוש דטרמיניסטי / HITL, בלי כתיבה אוטומטית ל־PMS.

| פריט | סטטוס | נקודת כניסה |
|------|--------|-------------|
| Reputation AI | ✅ | `POST /v1/public/reputation/ingest/:provider` · Executive ops card |
| Upsell AI | ✅ | Guest stay hub · Admin booking panel · `/v1/ops/upsells` |
| Incident Center | ✅ | Executive nav «מרכז אירועים» · `GET /v1/ops/incidents` |
| Revenue + Forecast | ✅ | CIO digest · `GET /v1/ops/forecast` · revenue suggestions HITL |
| Energy Management | ✅ | CIO digest + ops dashboard · `/v1/ops/energy` · optional meter ingest |
| Predictive Maintenance | ✅ MVP | `POST /v1/public/equipment/ingest` · `POST /v1/ops/equipment/scan` · כרטיס «תחזוקה חזויה» |

עדיין מחוץ לסקופ: IoT/BMS חי (שליטה אוטומטית), PMS rate writeback.

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

## 5. Energy Management (MVP)

### הצעות (HITL)
| תפוסה / מצב | הצעה |
|-------------|------|
| < 40% | setback HVAC (חיסכון ~8–15%) |
| ≥ 85% | אזהרת peak load |
| קומה ריקה לחלוטין | כיבוי/הנמכת HVAC בקומה (~10%) |

טבלאות `energy_suggestions` + אופציונלי `energy_readings` · Accept/Dismiss דורש `canDecideOpsHitl` · **אין** שליטה BMS אוטומטית.

### API
- `POST /v1/ops/energy/suggestions/generate?hotelId=`
- `GET /v1/ops/energy/suggestions?hotelId=`
- `POST /v1/ops/energy/suggestions/:id/decide` — `{ "decision": "accepted"|"dismissed" }`
- אופציונלי: `POST /v1/public/energy/ingest` — סוד `ENERGY_INGEST_SECRET`

## 6. Predictive Maintenance (MVP — ללא IoT חי)

- טבלאות `equipment_assets`, `equipment_signals`, `maintenance_predictions`
- חוקים: תחזוקה חוזרת ב-30 יום, קודי שגיאה, שעות פעולה, heuristics למעלית/דוד
- סריקה: `POST /v1/ops/equipment/scan?hotelId=` · risk≥70 → `department_tasks` (maintenance, high)
- webhook stub: `POST /v1/public/equipment/ingest` + `EQUIPMENT_INGEST_SECRET`
- UI: כרטיס «תחזוקה חזויה» ב־Executive ops + Incident Center + Admin תחזוקה

## Demo מהיר

1. **Reputation** — `curl` ל־`/v1/public/reputation/ingest/google` עם `REPUTATION_INGEST_SECRET` → כרטיס ביקורות שליליות ב־Executive
2. **Upsell** — Admin «הצע upsells» על הזמנה → Guest חיפוש שהייה
3. **Incidents** — Executive → מרכז אירועים (אחרי VMS/Sentry/anomaly)
4. **Revenue/Forecast** — CIO digest → צור הצעות תמחור + תחזית 7 ימים
5. **Predictive Maintenance** — רשום נכס → webhook אות → סריקה → כרטיס «תחזוקה חזויה»
6. **Energy** — CIO digest / ops dashboard → צור הצעות אנרגיה; אופציונלי `curl` meter ingest
