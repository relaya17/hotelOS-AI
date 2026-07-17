# HotelOS AI

**The AI Intelligence Layer for Hotels**

מערכת הפעלה למלונות (Turbo OS) — שכבת אינטליגנציה ו־AI מעל תפעול הרשת, המלון והאורח.  
שלוש אפליקציות נפרדות, כל אחת עם כתובת משלה; Backend משותף אחד.

## האפליקציות

| אפליקציה | רמה | תפקיד | כתובת מקומית |
|-----------|------|--------|----------------|
| **Executive** | רשת / אזור | לוח בקרה Multi-Hotel, Turbo OS, בריפינגים | http://localhost:5173 |
| **Admin** | מלון בודד | חדרים, הזמנות, כשרות, נוכחות מהטלפון | http://localhost:5174 |
| **Guest** | אורח | חיפוש שהייה + מסמכי Legal | http://localhost:5175 |
| **API** | שרת נפרד | Auth, תפעול, Turbo, Trust, סוכנים | http://localhost:3001 |

ארכיטקטורה נכונה בפרודקשן: **4 כתובות** — אורח · מלון · הנהלה · **API נפרד**.  
ב־Vercel הדפדפן קורא לאותו דומיין; `middleware.ts` מעביר ל־API (בלי CORS/localhost).  
מדריך: [`docs/deployment/four-projects.md`](docs/deployment/four-projects.md).

## Turbo OS (ב־Executive)

| מודול | תיאור |
|--------|--------|
| **לוח בקרה לרשת** | KPIs לכל המלונות, תפוסה, הזמנות פעילות |
| **חדרי בריפינג** | HotelOS Meet — מנהל אזור + צוותים; שיתוף סוכן; **הקלטת פגישות** |
| **הנהלת חשבונות** | ספר ראשי פנימי (`hotelos.internal`) + מחבר ל־ERP חיצוני |
| **צ׳אט עובדים** | הוראה נכתבת פעם אחת — כל עובד מקבל בשפת ההעדפה שלו |
| **אוטומציות** | כללים לכל שכבה (ניקיון, הזמנות, כספים, תרגום, קול, סגירת יום) |
| **סוכן קולי** | זיהוי קול / טקסט → כוונה → הפעלת אוטומציה |
| **i18n** | ממשק ב־10 שפות (מילונים מאומתים) |
| **מובייל / PWA** | Manifest בכל שלוש האפליקציות + UI רספונסיבי |

### שפות נתמכות

`he` · `en` · `ar` · `ru` · `es` · `th` · `zh` · `hi` · `tr` · `el`  
(עברית וערבית ב־RTL)

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
| **משגיח כשרות** (`agent.kashrut`) | מושב תמידי במלונות כשרים — הערה / אזהרה / חסימה על F&B, רכש מזון ואירועים; מחובר ל־F&B + הנהלה |
| **Org Comms** | ערוצים ישירים: בעלים ↔ מנכ״ל · מנכ״ל ↔ יח״צ / HR / F&B / חדרים+משק / קבלה / … · נתיב כשרות נפרד |

ניתן לשתף סוכן לתוך חדר בריפינג (למשל ועדת כספים + CFO, או בריפינג בוקר + CIO + משגיח כשרות).

דמו מוכן: **ועדת כספים — רבעון נוכחי**.  
מימוש מלא של CIO / Kashrut / Org Comms — לפי Roadmap P6+; המפרט כבר בריפו.

### הקלטות פגישות (HotelOS Meet)

אפשר להקליט את הפגישה בחדר הבריפינג. השמירה נעשית עם **הפרדות מלאות**:

| שכבה | איך מופרד |
|--------|-----------|
| **מטא־דאטה ב־DB** | `briefing_recordings` עם `tenant_id` + `chain_id` + `room_id` |
| **קובץ מדיה** | `.data/recordings/{tenantId}/{chainId}/{roomId}/{recordingId}.webm` |
| **תמלול חדר** | Snapshot של הודעות החדר בזמן סיום ההקלטה (`transcript_json`) |

גישה למדיה רק עם JWT של אותו tenant — אין ערבוב בין רשתות/חדרים.

## הרצה

דרישות: Node.js ≥ 22, pnpm 9.

```bash
pnpm install
cp .env.example .env   # אם עדיין אין .env
pnpm typecheck
pnpm dev
```

`pnpm dev` מריץ במקביל: API + Executive + Admin + Guest.

אם פורט תפוס (למשל 5173–5175 / 3001) — עצרו את המופע הקודם לפני הרצה מחדש.

### התחברות צוות (Executive / Admin)

| שדה | ערך |
|------|------|
| Email | `admin@demo.hotelos.local` |
| Password | `HotelOS-Demo-ChangeMe1!` |
| Tenant ID | `11111111-1111-4111-8111-111111111111` |

כפתור **המשך עם Google (צוות)** — בלי מפתחות: דמו מקומי; עם `GOOGLE_CLIENT_ID`/`SECRET`: OAuth מלא (`/start` → `/callback` → חזרה ל־Executive).  
**התחברות באצבע/פנים** — אחרי רישום ביומטרי במסך Trust.  
סשן: רענון JWT אוטומטי ב־401 · `POST /v1/auth/logout` מבטל refresh בשרת.

### אורח (Guest)

אימייל דמו: `noa@example.com`  
מסמכי חוק: `http://localhost:5175/?doc=terms|cookies|security|privacy`

## QA — בדיקה מלאה בפקודה אחת

```bash
pnpm qa
```

פקודה אחת שמריצה על כל 4 האפליקציות ועל כל החבילות המשותפות, בסדר הזה, ועוצרת בכל שלב שנכשל:

1. **Install** — `pnpm install --frozen-lockfile` (מוודא שה־lockfile תואם ל־package.json בכל המונורפו).
2. **Typecheck** — `tsc --noEmit` בכל חבילה/אפליקציה (TypeScript strict מלא: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` ועוד).
3. **Lint** — ESLint (flat config, `eslint.config.mjs`) עם `typescript-eslint` בטעינה מודעת-טיפוסים (type-aware: תופס `no-floating-promises`, `no-misused-promises` וכו') + `eslint-plugin-react-hooks`/`react-refresh` על שלוש אפליקציות ה־React.
4. **Test** — `node --test` בכל חבילה שיש לה בדיקות (`turbo run test`).
5. **Build** — בנייה מלאה של כל 4 האפליקציות + כל החבילות (`turbo run build`).

Turborepo מקצר ריצות חוזרות (cache לפי hash של קבצי הקלט), כך שריצה שנייה ללא שינויים תסתיים תוך שניות. להרצה מהירה יותר בפיתוח שוטף (בלי install/build מלאים):

```bash
pnpm typecheck && pnpm lint && pnpm test
```

ה־CI ב־GitHub Actions (`.github/workflows/ci.yml`) מריץ את אותם השלבים בכל push/PR.

## Trust · ציות · נוכחות

| יכולת | איפה | API |
|--------|------|-----|
| תנאי שימוש / עוגיות / אבטחה / פרטיות | Guest + קישורים בכל האפליקציות | `GET /v1/public/legal` |
| באנר הסכמת עוגיות | כל האפליקציות | `POST /v1/trust/cookies/consent` |
| תשלומים פנימיים + חתימה דיגיטלית | Executive → Trust | `/v1/trust/payments/*` · `/v1/trust/signatures` |
| WebAuthn (אצבע / פנים) | Executive → Trust | `/v1/trust/webauthn/*` |
| זיהוי קול (enrollment + verify) | נוכחות / Trust | `/v1/trust/voice/*` |
| Google לצוות | Login Executive/Admin | `/v1/trust/oauth/google/*` |
| שעון כניסה/יציאה מהטלפון + מעקב לעובד | Executive + Admin | `/v1/trust/attendance/*` |

נוכחות: לכל אירוע `clock_in` / `clock_out` נשמרים tenant, עובד, מלון, מכשיר, אופציונלית GPS, חתימה, דגלים ל־voice/WebAuthn — עם audit.

### נתוני דמו

- רשת: **Demo Chain Israel**
- מלונות: Tel Aviv, Eilat
- תפקידי משתמש דמו: `admin` + `executive`

## מבנה המונורפו

```
apps/
  executive/     # רמת רשת + Turbo OS
  admin/         # תפעול מלון
  guest/         # אורחים
  api/           # Hono API

packages/
  i18n/          # שפות + תרגום צ׳אט מאומת
  legal/         # תנאי שימוש, עוגיות, אבטחה, פרטיות
  features/      # מסכים משותפים (נוכחות, LegalFooter)
  web-client/    # לקוח API משותף
  ui/            # עיצוב / קומפוננטות (+ CookieBanner, SignaturePad)
  database/      # libSQL/Turso (file: מקומי) + Drizzle + seed
  auth/          # JWT + סיסמאות
  shared/ config/ validation/ logger/

פריסה: `docs/deployment/vercel.md` · ADR מסד נתונים: `docs/adr/0006-libsql-turso-hosted-db.md`
```

מסד נתונים מקומי: `.data/hotelos.sqlite` (ב־gitignore).

## API עיקרי

| נתיב | תיאור |
|--------|--------|
| `POST /v1/auth/login` | התחברות |
| `GET /v1/overview/chain` | סקירת רשת |
| `GET /v1/hotels` · rooms · bookings | תפעול מלון |
| `GET /v1/agents` | קטלוג סוכנים |
| `GET/POST /v1/briefing-rooms` | חדרי בריפינג + שיתוף סוכן |
| `POST .../recordings/start` · `complete` · `media` | הקלטת פגישה + שמירה מופרדת |
| `GET/POST /v1/turbo/*` | חשבונאות, צ׳אט, אוטומציות, קול |
| `GET /v1/public/legal` | מסמכי ציות |
| `POST /v1/trust/*` | עוגיות, תשלומים, חתימה, WebAuthn, קול, Google, נוכחות |
| `POST /v1/public/stays/lookup` | חיפוש שהייה לאורח |
| `GET /v1/ops/cio-digest` | תדריך יועץ־על לפי תפקיד |
| `/v1/org-comms/*` · `/v1/knowledge/*` · `/v1/kashrut/*` | Org Comms, Trusted sources, כשרות |
| `GET/POST /v1/ai/gateway/*` | AI Gateway — נקודת כניסה יחידה לסוכנים (דטרמיניסטי או LLM) |

CORS: מקורות ב־`CORS_ORIGINS` (ברירת מחדל — שלוש האפליקציות המקומיות).

## תיעוד

| סוג | נתיב |
|-----|------|
| Engineering Standard | [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) |
| ADRs | [`docs/adr/README.md`](docs/adr/README.md) |
| PRD / SRS | [`docs/prd/`](docs/prd/) · [`docs/srs/`](docs/srs/) |
| Architecture / ERD / Diagrams | [`docs/architecture/`](docs/architecture/) · [`docs/erd/`](docs/erd/) · [`docs/diagrams/`](docs/diagrams/) |
| OpenAPI inventory | [`docs/openapi/README.md`](docs/openapi/README.md) |
| Manuals / Runbooks / Security / Dev | [`docs/manuals/`](docs/manuals/) · [`docs/runbooks/`](docs/runbooks/) · [`docs/security/`](docs/security/) · [`docs/dev/`](docs/dev/) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## פריסה (Deployment)

הפרויקט מוכן לפריסה ל-Vercel — **4 פרויקטים נפרדים** (executive/admin/guest/api), כל אחד בנפרד מאותו ה-repo, עם דומיין משלו.
מדריך מלא: [`docs/deployment/vercel.md`](docs/deployment/vercel.md).

מסד הנתונים בפרודקשן עבר מ-`better-sqlite3` המקומי ל-`libSQL`/`Turso` (Vercel לא תומך בדיסק קבוע) —
פרטים ב-[`docs/adr/0006-libsql-turso-hosted-db.md`](docs/adr/0006-libsql-turso-hosted-db.md).
פיתוח מקומי (`pnpm dev`) לא השתנה.

## SEO ושיווק

| אפליקציה | מדיניות |
|---|---|
| **Guest** | ציבורית ומקודמת: title/description עשירים, Open Graph + Twitter card, תמונת שיתוף ממותגת (`og-image.png`), JSON-LD (`WebApplication`), `robots.txt` + `sitemap.xml` שמאשרים אינדקס. עמוד הבית נכתב כדף נחיתה קצר (הבטחת ערך, 3 יתרונות מרכזיים) ולא רק כטופס חיפוש. |
| **Executive / Admin** | כלי פנימי מאחורי כניסה — `<meta name="robots" content="noindex, nofollow">` + `robots.txt` שחוסם הכל. אין טעם, ויש סיכון פרטיות, לדרג כלי ניהול פנימי בגוגל. |

לפני פריסה לפרודקשן: לעדכן את כתובות ה-`canonical`/`og:url`/`sitemap.xml` בתוך `apps/guest/index.html` ו-`apps/guest/public/` מהדומיין הזמני (`guest.hotelos.ai`) לדומיין האמיתי שנרכש.

## תיעוד

| מסמך | תוכן |
|--------|------|
| [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) | מפרט הנדסי מחייב |
| [`docs/engineering-standard/11-ai-agents/`](docs/engineering-standard/11-ai-agents/) | קטלוג סוכנים |
| [`docs/adr/0003-three-separate-apps.md`](docs/adr/0003-three-separate-apps.md) | שלוש אפליקציות נפרדות |
| [`docs/adr/0004-turbo-os-i18n-automations.md`](docs/adr/0004-turbo-os-i18n-automations.md) | Turbo OS, i18n, אוטומציות |
| [`docs/adr/0005-trust-compliance-attendance.md`](docs/adr/0005-trust-compliance-attendance.md) | Trust, Google, נוכחות |
| [`docs/adr/0006-libsql-turso-hosted-db.md`](docs/adr/0006-libsql-turso-hosted-db.md) | libSQL/Turso לפריסה |
| [`docs/deployment/vercel.md`](docs/deployment/vercel.md) | פריסת 4 פרויקטי Vercel |
| [`docs/planning/employee-hr-module.md`](docs/planning/employee-hr-module.md) | תכנון: הרשמה עצמית לעובדים, מבחני יכולת, תעודת יושר |
| [`docs/planning/facilities-ops-module.md`](docs/planning/facilities-ops-module.md) | תכנון: תפעול לכל מחלקות המלון, רכש, קבלנים, מלאי, פידבק אורחים, דשבורד הנהלה |
| [`docs/planning/smart-integrations-and-hardening.md`](docs/planning/smart-integrations-and-hardening.md) | סקר: מצלמות AI, כרטיסים חכמים, ניטור שגיאות, נגישות, אבטחה, סוכן פנימי לפתרון בעיות |

## רישיון / סטטוס

פרויקט בפיתוח פעיל — foundation + Turbo OS P1.  
מיצוב מוצר: Intelligence Layer תחילה (אינטגרציה / שכבה חכמה), לא rip-and-replace של PMS ביום הראשון.
