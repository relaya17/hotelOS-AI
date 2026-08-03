# HotelOS AI

**Hotel Intelligence Platform** — *The AI & Operations Layer for Hotels*

לא תחליף ל־PMS ביום הראשון. HotelOS היא **שכבת AI ותפעול** שמתחברת מעל המערכות הקיימות  
(Opera · Protel · Fidelio · Clock PMS · Mews ועוד) — הרשת בוחרת **אילו דומיינים** לחבר בפיילוט.  
כך יורד חסם האימוץ: בלי rip-and-replace, עם ROI מדיד (תדריכים, תקלות, ניקיון, upsell).

ארבע אפליקציות פרונט + Backend משותף · Turbo OS לרשת · משימות ותובנות למלון ולאורח.  
מיצוב מפורט + מדדי פיילוט: [`docs/planning/hotel-intelligence-platform.md`](docs/planning/hotel-intelligence-platform.md) · [`pilot-roi-scorecard.md`](docs/planning/pilot-roi-scorecard.md).

## האפליקציות

| אפליקציה | רמה | תפקיד | כתובת מקומית |
|-----------|------|--------|----------------|
| **Executive** | רשת / אזור | לוח בקרה Multi-Hotel, Turbo OS, בריפינגים | http://localhost:5173 |
| **Admin** | מלון בודד | חדרים, הזמנות, כשרות, תפעול מחלקות | http://localhost:5174 |
| **Guest** | אורח | חיפוש שהייה, הזמנה, מסמכי Legal | http://localhost:5175 |
| **Work** | עובד | נוכחות, הזמנה עצמית (invite), סוכן HR, מסמכים | http://localhost:5176 |
| **API** | שרת נפרד | Auth, תפעול, Turbo, Trust, סוכנים, webhooks | http://localhost:3001 |

ארכיטקטורה בפרודקשן: **5 כתובות** — אורח · מלון · הנהלה · עובדים · **API נפרד**.  
ב־Vercel הדפדפן קורא לאותו דומיין; `middleware.ts` מעביר ל־API (בלי CORS/localhost).  
מדריך: [`docs/deployment/four-projects.md`](docs/deployment/four-projects.md) · [`docs/deployment/vercel.md`](docs/deployment/vercel.md).

## Turbo OS (ב־Executive)

| מודול | תיאור |
|--------|--------|
| **לוח בקרה לרשת** | KPIs לכל המלונות, תפוסה, הזמנות פעילות |
| **חדרי בריפינג** | HotelOS Meet — ועדות, **הדרכות** ו־all-hands; שיתוף סוכן + **מזכירת פגישות**; **הסכמה להקלטה** (`meetings.2026.1`); קישור Work `?meetInvite=` |
| **הנהלת חשבונות** | ספר ראשי פנימי (`hotelos.internal`) + מחבר ל־ERP חיצוני + סגירת חודש HITL |
| **צ׳אט עובדים** | הוראה נכתבת פעם אחת — כל עובד מקבל בשפת ההעדפה שלו |
| **אוטומציות** | כללים לכל שכבה (ניקיון, הזמנות, כספים, תרגום, קול, סגירת יום) |
| **סוכן קולי** | זיהוי קול / טקסט → כוונה → הפעלת אוטומציה |
| **i18n** | ממשק ב־10 שפות (מילונים מאומתים ב־`@hotelos/i18n`) |
| **מובייל / PWA** | Manifest באפליקציות הפרונט + UI רספונסיבי |

### שפות נתמכות

| קוד | שם | כיוון |
|-----|-----|--------|
| `he` | עברית | RTL |
| `en` | English | LTR |
| `ar` | العربية | RTL |
| `ru` | Русский | LTR |
| `es` | Español | LTR |
| `th` | ไทย | LTR |
| `zh` | 中文 | LTR |
| `hi` | हिन्दी | LTR |
| `tr` | Türkçe | LTR |
| `el` | Ελληνικά | LTR |

מקור האמת: [`packages/i18n/src/locales.ts`](packages/i18n/src/locales.ts).

בצ׳אט עובדים: תרגום מאומת (`verified`) למשפטי דמו מוכנים; טקסט חופשי מסומן `provisional` עד אישור.

הוראות דמו מוכנות:  
«נקו את החדר 102 לפני הצ׳ק־אין» · «בדקו את תזרים המזומנים של הרשת להיום» · ועוד.

### סוכנים חכמים

קטלוג מתוך Engineering Standard ([Vol. 11](docs/engineering-standard/11-ai-agents/README.md)) + [ADR 0007](docs/adr/0007-cio-orchestrator-kashrut-org-comms.md):

| שכבה | תפקיד |
|------|--------|
| **AI Gateway** | נקודת כניסה יחידה (`/v1/ai/gateway`) — דטרמיניסטי בלי מפתח; LLM עם `AI_GATEWAY_API_KEY` ([ADR 0008](docs/adr/0008-ai-gateway.md)) |
| **CIO Orchestrator** (`agent.cio`) | יועץ־על בחזית דרך Gateway: תדריך יומי + שאלות; מתזמר מומחים |
| **מומחים** | CEO, CFO, Revenue, Housekeeping, Reception, HR, Marketing, Guest, Concierge, Analytics, Sales, Legal, … |
| **משגיח כשרות** (`agent.kashrut`) | מושב תמידי במלונות כשרים — הערה / אזהרה / חסימה על F&B, רכש מזון ואירועים |
| **Org Comms** | ערוצים ישירים בין בעלים, מנכ״ל ומחלקות · נתיב כשרות נפרד |

ניתן לשתף סוכן לתוך חדר בריפינג (למשל ועדת כספים + CFO, או בריפינג בוקר + CIO + משגיח כשרות).

דמו מוכן: **ועדת כספים — רבעון נוכחי**.

### הקלטות פגישות (HotelOS Meet)

| שכבה | איך מופרד |
|--------|-----------|
| **מטא־דאטה ב־DB** | `briefing_recordings` עם `tenant_id` + `chain_id` + `room_id` |
| **קובץ מדיה** | `.data/recordings/{tenantId}/{chainId}/{roomId}/{recordingId}.webm` |
| **תמלול חדר** | Snapshot של הודעות החדר בזמן סיום ההקלטה (`transcript_json`) |

גישה למדיה רק עם JWT של אותו tenant — אין ערבוב בין רשתות/חדרים.

**סוגי חדר:** `committee` (ועדה), `training` (הדרכה — מומלץ `agent.meeting_secretary`), `all_hands`.  
**הצטרפות עובדים:** Work → `/?meetInvite={token}` · **סיום פגישה:** סיכום AI + יעדים אוטומטיים לאחר אישור מדיניות ההקלטה.

## הרצה

דרישות: Node.js ≥ 22, pnpm 9.

```bash
pnpm install
cp .env.example .env   # אם עדיין אין .env
pnpm typecheck
pnpm dev
```

`pnpm dev` מריץ במקביל: **API + Executive + Admin + Guest + Work**.

אם פורט תפוס (5173–5176 / 3001) — עצרו את המופע הקודם לפני הרצה מחדש.

### התחברות צוות (Executive / Admin / Work)

| שדה | ערך |
|------|------|
| Email | `admin@demo.hotelos.local` |
| Password | `HotelOS-Demo-ChangeMe1!` |
| Tenant ID | `11111111-1111-4111-8111-111111111111` |

כפתור **המשך עם Google (צוות)** — בלי מפתחות: דמו מקומי; עם `GOOGLE_CLIENT_ID`/`SECRET`: OAuth מלא.  
**התחברות באצבע/פנים** — אחרי רישום ביומטרי במסך Trust.  
סשן: רענון JWT אוטומטי ב־401 · `POST /v1/auth/logout` מבטל refresh בשרת.

### אורח (Guest)

אימייל דמו: `noa@example.com`  
מסמכי חוק: `http://localhost:5175/?doc=terms|cookies|security|privacy`

## QA — בדיקה מלאה בפקודה אחת

```bash
pnpm qa
```

1. **Install** — `pnpm install --frozen-lockfile`
2. **Typecheck** — `tsc --noEmit` בכל חבילה/אפליקציה
3. **Lint** — ESLint flat config + type-aware rules + jsx-a11y על אפליקציות React
4. **Test** — `turbo run test` (כולל יחידות API; Playwright axe מדלג אם אין Chromium)
5. **Build** — בנייה מלאה של 5 היחידות הפריסות + חבילות

הרצה מהירה בפיתוח:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

נגישות login (Playwright + axe):

```bash
pnpm --filter @hotelos/a11y-e2e install:browsers
pnpm test:a11y-e2e
```

ה־CI (`.github/workflows/ci.yml`) מריץ quality gate + job נפרד `a11y-login`.

כלי פריסה מקומיים:

| פקודה | תפקיד |
|--------|--------|
| `pnpm check:vercel-api` | Preflight ל־env של ה־API (Turso, JWT, secrets) |
| `pnpm generate:ops-secrets` | יצירת `CRON_SECRET` / `SECURITY_INGEST_SECRET` / `SENTRY_INGEST_SECRET` |
| `pnpm ping:turso` | בדיקת חיבור ל־Turso |

## Trust · ציות · נוכחות

| יכולת | איפה | API |
|--------|------|-----|
| תנאי שימוש / עוגיות / אבטחה / פרטיות | Guest + קישורים בכל האפליקציות | `GET /v1/public/legal` |
| באנר הסכמת עוגיות | כל האפליקציות | `POST /v1/trust/cookies/consent` |
| תשלומים פנימיים + חתימה דיגיטלית | Executive → Trust | `/v1/trust/payments/*` · `/v1/trust/signatures` |
| WebAuthn (אצבע / פנים) | Executive → Trust | `/v1/trust/webauthn/*` |
| זיהוי קול (enrollment + verify) | נוכחות / Trust | `/v1/trust/voice/*` |
| Google לצוות | Login Executive/Admin/Work | `/v1/trust/oauth/google/*` |
| שעון כניסה/יציאה מהטלפון | Work + Executive + Admin | `/v1/trust/attendance/*` |

### נתוני דמו

- רשת: **Demo Chain Israel**
- מלונות: Tel Aviv, Eilat
- תפקידי משתמש דמו: `admin` + `executive` (+ תפקידים כמו `accountant` / `cfo` לפי seed)

## מבנה המונורפו

```
apps/
  executive/     # רמת רשת + Turbo OS
  admin/         # תפעול מלון
  guest/         # אורחים
  work/          # עובדים (נוכחות / invite / HR)
  api/           # Hono API

packages/
  i18n/          # 10 שפות + תרגום צ׳אט מאומת
  legal/         # תנאי שימוש, עוגיות, אבטחה, פרטיות
  features/      # מסכים משותפים (נוכחות, LegalFooter)
  web-client/    # לקוח API משותף
  ui/            # עיצוב / קומפוננטות (+ CookieBanner, SignaturePad)
  database/      # libSQL/Turso + Drizzle + seed
  auth/          # JWT + סיסמאות
  a11y-e2e/      # Playwright + axe על מסכי login
  shared/ config/ validation/ logger/

פריסה: docs/deployment/vercel.md
ADR מסד נתונים: docs/adr/0006-libsql-turso-hosted-db.md
```

מסד נתונים מקומי: `.data/hotelos.sqlite` (ב־gitignore).

## API עיקרי

| נתיב | תיאור |
|--------|--------|
| `GET /health` · `GET /v1/health` | Health check (uptime monitors) |
| `POST /v1/auth/login` | התחברות |
| `GET /v1/overview/chain` | סקירת רשת |
| `GET /v1/hotels` · rooms · bookings | תפעול מלון |
| `GET /v1/agents` | קטלוג סוכנים |
| `GET/POST /v1/briefing-rooms` | חדרי בריפינג + שיתוף סוכן |
| `POST .../recordings/start` · `complete` · `media` | הקלטת פגישה |
| `GET/POST /v1/turbo/*` | חשבונאות, צ׳אט, אוטומציות, קול |
| `GET /v1/public/legal` | מסמכי ציות |
| `POST /v1/public/stays/lookup` | חיפוש שהייה לאורח |
| `POST /v1/public/security/ingest/:provider` | VMS webhook (Milestone/Genetec/…) — `SECURITY_INGEST_SECRET` |
| `POST /v1/public/sentry/ingest` | Sentry → משימת IT — `SENTRY_INGEST_SECRET` |
| `POST /v1/trust/*` | עוגיות, תשלומים, חתימה, WebAuthn, קול, Google, נוכחות |
| `GET /v1/ops/cio-digest` | תדריך יועץ־על לפי תפקיד |
| `/v1/org-comms/*` · `/v1/knowledge/*` · `/v1/kashrut/*` | Org Comms, Trusted sources, כשרות |
| `GET/POST /v1/ai/gateway/*` | AI Gateway |
| `/v1/cron/*` | Cron (Vercel) — `CRON_SECRET` |

CORS: מקורות ב־`CORS_ORIGINS` (ברירת מחדל — ארבע אפליקציות הפרונט המקומיות).

## פריסה (Deployment)

**5 פרויקטי Vercel** מאותו repo (`executive` / `admin` / `guest` / `work` / `api`).  
מדריך: [`docs/deployment/vercel.md`](docs/deployment/vercel.md).

מסד בפרודקשן: **Turso / libSQL** ([ADR 0006](docs/adr/0006-libsql-turso-hosted-db.md)).  
פיתוח מקומי (`pnpm dev`) יכול להמשיך עם SQLite קובץ.

Runbooks נוספים:

| מסמך | נושא |
|------|------|
| [`vms-pilot-runbook.md`](docs/deployment/vms-pilot-runbook.md) | פיילוט VMS + צ׳קליסט תיקון 13 |
| [`staging-production-checklist.md`](docs/deployment/staging-production-checklist.md) | Staging מול Production |
| [`turso-backup-restore.md`](docs/deployment/turso-backup-restore.md) | גיבוי / שחזור |
| [`uptime-monitoring.md`](docs/deployment/uptime-monitoring.md) | מוניטור חיצוני על `/v1/health` |

## SEO ושיווק

| אפליקציה | מדיניות |
|---|---|
| **Guest** | ציבורית: title/description, Open Graph, JSON-LD, `robots.txt` + `sitemap.xml` |
| **Executive / Admin / Work** | כלי פנימי — `noindex, nofollow` + `robots.txt` שחוסם הכל |

לפני פרודקשן: לעדכן `canonical` / `og:url` / `sitemap` ב־`apps/guest` לדומיין האמיתי.

## תיעוד

| מסמך | תוכן |
|--------|------|
| [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) | מפרט הנדסי מחייב (v1.0 Approved) |
| [`docs/engineering-standard/11-ai-agents/`](docs/engineering-standard/11-ai-agents/) | קטלוג סוכנים |
| [`docs/adr/README.md`](docs/adr/README.md) | ADRs |
| [`docs/adr/0003-three-separate-apps.md`](docs/adr/0003-three-separate-apps.md) | אפליקציות נפרדות (בסיס; Work נוסף בהמשך) |
| [`docs/adr/0004-turbo-os-i18n-automations.md`](docs/adr/0004-turbo-os-i18n-automations.md) | Turbo OS, i18n, אוטומציות |
| [`docs/adr/0005-trust-compliance-attendance.md`](docs/adr/0005-trust-compliance-attendance.md) | Trust, Google, נוכחות |
| [`docs/adr/0006-libsql-turso-hosted-db.md`](docs/adr/0006-libsql-turso-hosted-db.md) | libSQL/Turso |
| [`docs/adr/0008-ai-gateway.md`](docs/adr/0008-ai-gateway.md) | AI Gateway |
| [`docs/openapi/README.md`](docs/openapi/README.md) | OpenAPI inventory |
| [`docs/planning/hotel-intelligence-platform.md`](docs/planning/hotel-intelligence-platform.md) | מיצוב HIP + התממשקות מודולרית מעל PMS |
| [`docs/planning/pilot-roi-scorecard.md`](docs/planning/pilot-roi-scorecard.md) | מדדי ROI לפיילוט (תדריך −70%, תקלות, upsell…) |
| [`docs/planning/must-have-growth.md`](docs/planning/must-have-growth.md) | Reputation · Upsell · Incidents · Revenue/Forecast |
| [`docs/planning/smart-integrations-and-hardening.md`](docs/planning/smart-integrations-and-hardening.md) | Hardening + אינטגרציות חכמות |
| [`docs/planning/employee-hr-module.md`](docs/planning/employee-hr-module.md) | תכנון HR |
| [`docs/planning/facilities-ops-module.md`](docs/planning/facilities-ops-module.md) | תכנון תפעול מחלקות |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | תרומה לפרויקט |

### PMS / connectors

`PMS_PROVIDER` = `demo` · `mews` · `mews_stub` · `opera_stub` · `protel_stub` · `fidelio_stub` · `clock_stub`  
קטלוג דומיינים: `@hotelos/connectors` → `INTEGRATION_DOMAINS`.

## רישיון / סטטוס

פרויקט בפיתוח פעיל — **Hotel Intelligence Platform** (שכבת AI/תפעול מעל PMS) + Turbo OS + must-have growth MVP.  
פיילוט: למדוד ROI לפי [`pilot-roi-scorecard.md`](docs/planning/pilot-roi-scorecard.md); VMS/תיקון 13 ו־Vercel — במסמכי הפריסה.
