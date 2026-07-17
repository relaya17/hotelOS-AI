# כרך 6 — Database Architecture

**Version:** 1.0 (Draft)  
**Owner:** Data Architect

---

## 6.1 עקרון

לא מסד אחד ענק.  
כל Bounded Context מקבל מסד לוגי (ואם נדרש — פיזי) משלו, עם בעלות ברורה וסנכרון מבוקר.

## 6.2 Logical Databases

| DB | תחום | הערות |
|----|------|--------|
| `hotel_db` | Hotels, properties, configuration | |
| `guest_db` | Guests, preferences, consent | PII גבוה |
| `booking_db` | Reservations, stays, room assignments | |
| `billing_db` | Charges, payments, invoices | PCI scope מופרד |
| `accounting_db` | Ledger, journals, tax | |
| `inventory_db` | Stock, SKUs, par levels | |
| `employee_db` | Staff profiles, roles assignment | |
| `hr_db` | HR sensitive docs, payroll refs | גישה מוגבלת |
| `crm_db` | Segments, campaigns, tickets | |
| `maintenance_db` | Assets, work orders, parts | |
| `notifications_db` | Outbox, delivery status | |
| `analytics_db` | Warehousing / OLAP projections | Read-optimized |
| `audit_db` | Immutable audit trail | Append-only |
| `ai_memory_db` | Short/Operational/Customer/Company memory + embeddings meta | |
| `twin_db` (logical) | Digital Twin projections (rooms, assets, live ops) | נגזר מאירועים; לא SoT כספי |

שמות יישומיים יכולים להתמפה ל־schemas בתוך cluster אחד ב־SaaS, ול־instances נפרדים ב־Enterprise.

## 6.3 Multi-tenancy (היררכיה מחייבת)

```
Platform
  └── Tenant
        └── Hotel Chain
              └── Hotel
                    └── Department
                          └── User
```

כללים:

- כל רשומה עסקית נושאת לפחות `tenant_id`
- רשומות נכס/תפעול: גם `hotel_id` (ו־`chain_id` / `department_id` לפי הצורך)
- RLS / equivalent חובה בכל DB עם נתוני לקוח
- אין שאילתה חוצת־tenant; חוצת־hotel רק עם הרשאה מפורשת
- Vector / AI memory indexes מסוננים באותה היררכיה (כרך 5A)
- Single-tenant Enterprise: בידוד פיזי אפשרי בלי שינוי מודל הדומיין

דוגמה: Tenant = פתאל → Chains/Regions לפי מדינות → ~150 Hotels → Departments → אלפי Users.

## 6.4 ERD וניהול סכמה

- ERD לכל DB ב־`docs/erd/`
- מיגרציות גרסאות בלבד (אין שינוי ידני בפרודקשן)
- Backward-compatible migrations כברירת מחדל; שבירה = ADR + תוכנית rollout

## 6.5 מפתחות ואינדקסים

- PK: UUID v7 או ULID (ADR יקבע) — עקביות בכל המערכת
- FK מפורשים בתוך אותו DB לוגי
- Cross-DB: אין FK פיזי — סינכרון באירועים / correlation ids
- אינדקסים חובה לדוגמה:
  - `(tenant_id, hotel_id, status)` ב־bookings
  - `(tenant_id, guest_id)` בשהיות
  - `(tenant_id, created_at)` ב־audit
- איסור full table scans על טבלאות חמות בנתיבי API

## 6.6 Repository Pattern

- גישה ל־DB רק דרך Repositories ב־Infrastructure
- Transactions בגבול Use Case
- Outbox pattern לאירועים בין דאטהבייסים

## 6.7 Backup & Recovery

| סביבה | RPO מקסימלי | RTO מקסימלי |
|--------|-------------|-------------|
| Production SaaS | ≤ 15 דקות (או לפי SLA חוזי) | ≤ 4 שעות |
| Enterprise dedicated | לפי חוזה | לפי חוזה |
| Audit DB | Backup נפרד + WORM אם נדרש | |

חובה:

- גיבויים מוצפנים
- בדיקות restore תקופתיות (כרך 9 — DR drills)
- Point-in-time recovery ל־DBs קריטיים (booking, billing, audit)

## 6.8 נתונים רגישים

- הצפנה at-rest + in-transit
- Tokenization / vault לתשלומים — לא לשמור PAN ב־DB עסקי
- PII minimization ב־analytics
- Retention לפי כרך 12

## 6.9 Analytics

- `analytics_db` נבנה מאירועים/ETL — לא שאילתות כבדות על `booking_db` בפרודקשן interactive
- הגדרת SLA ל־freshness (למשל ≤ 5–15 דקות ל־Executive KPI)

## 6.10 קריטריוני אישור כרך 6

- [ ] רשימת logical DBs מאושרת
- [ ] מדיניות multi-tenant/RLS מאושרת
- [ ] RPO/RTO מאושרים
- [ ] עקרון no cross-DB FK מאושר
