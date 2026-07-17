# כרך 1 — Vision & Product Strategy

**Version:** 1.0 (Draft)  
**Owner:** Product / Strategy

---

## 1.1 חזון

### משפט מיצוב (מחייב)

> **The AI Intelligence Layer for Hotels**

לא מתחילים מ־"להחליף את Oracle".  
מתחילים בלהפוך את המערכות הקיימות לחכמות — ואחר כך, עם לקוחות ונתונים, מוסיפים מודולים שמאחדים תפעול.

### אסטרטגיית חדירה (Land & Expand)

| שלב | מה מוכרים | מה קורה אצל הלקוח |
|-----|-----------|-------------------|
| 1 — Intelligence Layer | AI Gateway, Agents, Twin, Simulator, Approvals | יושבים מעל PMS/CRM/ERP קיימים דרך connectors |
| 2 — Modular OS | Housekeeping, Guest, Maintenance, Revenue… | מחליפים מודולים אחד־אחד |
| 3 — Full HotelOS | ליבה מאוחדת לרשת | Multi-hotel + Single/Multi tenant מלא |

### חזון לטווח ארוך

**HotelOS AI Enterprise** — מערכת הפעלה לרשת מלונות + שכבת AI בכל מקום, במקום פיצול של 8–20 מערכות:

| תחום | מערכות נפרדות כיום | HotelOS AI (יעד) |
|------|-------------------|------------------|
| PMS | מערכת נפרדת | Intelligence Layer → ואז מודול ליבה |
| CRM / HR / ERP | מערכות נפרדות | חיבור תחילה → מודולים בהמשך |
| Channel / Booking | מערכות נפרדות | אינטגרציה + מודולים |
| Housekeeping / Maintenance | מערכות נפרדות | מודולים + AI |
| Revenue / BI | מערכות נפרדות | Agents + Analytics + Executive |

רשתות גדולות (פתאל, ישרוטל, Marriott, Hilton) מחברות לרוב **8–20 מערכות**.  
הדרך: **קודם חכמה על מה שיש → אם כך נבנית ליבה מאוחדת**, עם API פתוח לאינטגרציות (מנעולים, סליקה, רשויות, ערוצי הזמנות).

## 1.2 יעדים

### יעדי מוצר

1. ניהול Multi-Hotel מרכזי לרשת שלמה.
2. חוויית אורח ללא תלות בקבלה (mobile check-in, מפתח דיגיטלי, הזמנות שירות).
3. פלטפורמת AI עם עשרות סוכנים ייעודיים + Knowledge מאומת.
4. התראות חכמות (Push AI) ולא רק Chat תגובתי.
5. תמיכה ב־SaaS Multi-tenant וגם Enterprise Single-tenant.

### יעדי הנדסה

1. מפרט מחייב לפני קוד.
2. ארכיטקטורה מודולרית שמתרחבת מ־5 מלונות למאות בלי שבירת ליבה.
3. אבטחה, נגישות וציות כ־default.
4. Observability מלאה ו־Audit לכל פעולה עסקית.

### יעדי שוק

1. ישראל + שוק עולמי (i18n, multi-currency, timezones).
2. התאמה לרשתות גדולות ולמלונות/רשתות קטנות ב־SaaS.

## 1.3 Business Model & Pricing

### Enterprise (Single-tenant)

- התקנה ייעודית לרשתות גדולות (למשל פתאל, ישרוטל).
- בידוד נתונים מלא, SLA ייעודי, אינטגרציות מותאמות.
- תמחור מנחה: **$100K–$1M+ לשנה** (+ Implementation).

### Multi-tenant SaaS

| מקטע | תמחור מנחה | קהל |
|------|------------|-----|
| Small | **$500–$2,000 / חודש** | בוטיק, מלון יחיד |
| Mid | **$3,000–$10,000 / חודש** | מלון בינוני / רשת קטנה |
| Chain / Pro | לפי נכסים + usage AI | רשתות צומחות |

חבילות: Intelligence (שכבת AI בלבד) → Ops Modules → Full OS.

### שווקים מעבר למלונות קלאסיים

מלונות בוטיק · רשתות בינוניות · קבוצות אירוח · בתי חולים פרטיים · בתי אבות יוקרתיים · כפרי נופש  
(אותה היררכיית Tenant + Twin + Agents — עם התאמת דומיין.)

### עקרון ארכיטקטוני

אותה ליבת דומיין; הבדל בפריסה, בידוד ו־ops — לא בשכתוב מוצר.

## 1.4 היררכיית Multi-Tenant (פיצ'ר ליבה)

```
Platform
  └── Tenant                 (למשל: פתאל)
        └── Hotel Chain      (או אזורים / מדינות)
              └── Hotel      (×150 לדוגמה)
                    └── Department   (HK, F&B, Security…)
                          └── User   (אלפי משתמשים)
```

דוגמה: **פתאל** — Tenant אחד → עשרות מדינות/אזורים → כ־150 מלונות → אלפי משתמשים.

יכולות חובה:

- הרשאות לפי תפקיד × Department × Hotel × Chain × Tenant
- KPI מרוכזים + drill-down למלון
- Timezone ומטבע לכל נכס
- מדיניות רשת vs מדיניות מלון
- בידוד מוחלט בין Tenants

## 1.5 משטחי מוצר (Apps)

| App | קהל | תפקיד עיקרי |
|-----|------|-------------|
| `web-public` | אורחים פוטנציאליים | הזמנות, תוכן, SEO |
| `guest` | אורחים | Check-in/out, מפתח, שירותים, תשלום, צ'אט AI |
| `employee` | עובדים | משימות לפי תפקיד (HK, Reception, F&B, Security…) |
| `admin` | מנהלי מלון/אזור | תפעול יומיומי, מלאי, עובדים, תחזוקה |
| `executive` | מנכ״ל / הנהלת רשת | KPI בזמן אמת, שאלות בשפה טבעית, אישורים |
| `api` | מערכות חיצוניות | REST / WebSocket / Webhooks |
| `ai` | פלטפורמה פנימית | Gateway, Agents, Memory, RAG |
| `worker` | מערכת | Jobs, queues, importers |

### Mobile

ארבע אפליקציות מובייל (Android / iOS / Tablet לפי הצורך):

1. Guest App  
2. Employee App  
3. Manager App  
4. Executive App  

עדכונים שוטפים לסוכנים ולמשתמשים — כולל Push AI.

## 1.6 מודולי Admin (הנהלה)

Dashboard · Revenue · Occupancy · Bookings · Rooms · AI Analytics · BI · Employees · Inventory · Finance · CRM · Marketing · Reviews · Maintenance · Security · Multi Hotel

## 1.7 מודולי Employee (לפי הרשאות)

### Housekeeping
רשימת חדרים · ניקיון · דיווח תקלות · תמונות · AI Quality Check

### Reception
Check In/Out · Upsell · Payments · Room Upgrade

### Maintenance
תקלות · משימות · חלקי חילוף · AI המלצות תיקון

### Restaurant
הזמנות · מלאי · שולחנות

### Security
אירועים · מצלמות (אינטגרציה) · דיווחים

## 1.8 Guest Journey (ללא קבלה)

הזמנה → Check In מהטלפון → מפתח דיגיטלי → פתיחת דלת → אוכל / SPA / בריכה → ניקיון / מגבות → צ'אט עם המלון → תשלום / חשבוניות → Check Out

## 1.9 AI בכל מקום (דגש מוצר)

| יכולת | דוגמה |
|--------|--------|
| AI Receptionist | "אני רוצה חדר עם נוף לים" → טיפול בבקשה |
| AI Concierge | המלצות מסעדות / אטרקציות |
| AI Housekeeping | סדר עדיפויות, עובד קרוב, הערכת זמן |
| AI Maintenance | חיזוי תקלות (מזגן, מעלית, דוד, חשמל) |
| AI Revenue Manager | מחירים לפי ביקוש, עונה, אירועים, תפוסה, מתחרים |
| AI Marketing | חזרה, קופונים, מבצעים |
| AI Manager (בוקר) | תפוסה, חדרים לא נקיים, תלונות, חריגות תקציב |
| Push AI | התראות יזומות (תפוסה↓, מלאי↓, VIP מגיעים, חריגת תקציב) |

פירוט סוכנים: כרך 11.  
פירוט פלטפורמה: כרך 5.  
ארכיטקטורה: כרך 5A.

## 1.9A יכולות AI מתקדמות (חובה במפרט)

### Digital Twin של המלון
מודל וירטואלי חי: Floors · Rooms · Equipment · Employees · Guests · Revenue · Inventory — כדי שה־AI יבין את כל הנכס.

### AI Simulator
לפני החלטה — למשל: "אם מעלה מחיר ב־15%, מה יקרה?" — סימולציה עם הנחות וסיכונים, בלי ביצוע אוטומטי.

### Autonomous Operations
ה־AI מציע פעולות (מבצע סופ״ש? הזמנת מלאי קפה?) — המנהל מאשר **כן / לא** — ואז ביצוע. לא שליטה שקטה על כסף/בטיחות.

פירוט טכני: [05a-ai-architecture.md](./05a-ai-architecture.md).

## 1.10 Agent Knowledge Platform (אסטרטגיה)

כל סוכן מקבל ידע מ־3 מקורות (לפי הרשאות):

1. **Internal Knowledge** — הזמנות, לקוחות, עובדים, חשבוניות, KPI, מלאי, משמרות…  
2. **Trusted Knowledge** — מקורות חיצוניים מאומתים בלבד (רשויות, מזג אוויר, ספקי תשלום, ערוצי הזמנות…)  
3. **Company Knowledge** — SOP, HR, חוזים, הדרכות, תרבות הרשת  

**Continuous Learning מבוקר:**

```
Trusted Sources → Importer → Validation → Approval → Knowledge DB → Agents
```

אין ל־AI לשנות את עצמו ללא בקרה.

## 1.11 AI Memory (4 סוגים)

| סוג | תוכן |
|-----|------|
| Short Memory | שיחה נוכחית |
| Operational Memory | מידע חי מהמלון (דרך Twin / APIs) |
| Customer Memory | העדפות אורח — בהסכמה ופרטיות |
| Company Memory | נהלים ו־SOP |

Customer Memory כולל לדוגמה: חדר/אוכל/שפה, ביקורים, תלונות שטופלו, כריות/טמפרטורה.

## 1.12 Competitive Analysis (סיכום)

אין מוצר אחד שמרכז את כל זה עם AI בכל שכבה.  
הפער בשוק: שכבת אינטליגנציה אחידה מעל סטאק מפוצל — ואז מסלול ל־OS מודולרי.

**האתגר האמיתי:** אינטגרציות (מנעולים, הזמנות, סליקה, הנה״ח, מפתחות דיגיטליים).  
לכן: connectors תחילה, Monorepo, AI Platform נפרד, API פתוח.

## 1.13 Roadmap (רמה אסטרטגית)

| Phase | מיקוד | הערות |
|-------|--------|--------|
| P0 | אישור Engineering Standard | **חוסם קוד** |
| P1 | Foundation: monorepo, auth, tenancy hierarchy, audit, design system | |
| P2 | **Intelligence Layer MVP**: Gateway, connectors ל־PMS, Twin בסיסי, 2–3 Agents | ערך בלי להחליף PMS |
| P3 | RAG + Company Knowledge + Approvals + Push AI | |
| P4 | Simulator + Revenue/Maintenance agents | |
| P5 | Guest + Employee apps / modules | הרחבת OS |
| P6 | Autonomous Operations (suggest → approve → act) | בקרות חזקות |
| P7 | Enterprise single-tenant + מודולים שמחליפים ליבה | Scale |

פירוט milestones — ב־PRD לאחר אישור כרך זה.

## 1.14 ROI & פוטנציאל עסקי

מדדי מוצר: RevPAR/ADR · זמן check-in · זמן תגובה לתקלות · NPS · שעות ניהול שנחסכות · אימוץ אישורי AI.

פוטנציאל שוק: SaaS למלונות + הרחבה לאירוח/בריאות יוקרתית; Enterprise לרשתות גדולות.  
הערכת תמחור — סעיף 1.3 (מנחה בלבד; לא הצעת מחיר חוזית).

## 1.15 עקרונות מוצר מחייבים

- **Intelligence Layer first** — לא "rip and replace" ביום הראשון
- Offline-first במקומות אפשריים (עובדי מלון)
- API יציב עם Versioning + connectors
- Feature Flags
- Multi-tenant + Single-tenant
- i18n + multi-currency + per-hotel timezone
- Audit מלא
- Digital Twin + Simulator + Human Approval לאוטומציה
- מודולריות להרחבות: קזינו, כנסים, ספא, מועדוני נופש, השכרת רכבים — בלי שבירת ליבה

## 1.16 קריטריוני אישור כרך 1

- [ ] מיצוב "AI Intelligence Layer for Hotels" מאושר
- [ ] תמחור מנחה + מקטעי שוק מאושרים
- [ ] היררכיית Tenant מאושרת
- [ ] Digital Twin / Simulator / Autonomous כחלק מהחזון מאושרים
- [ ] Roadmap (Intelligence לפני החלפת PMS) מאושר — כולל P0 חוסם קוד
