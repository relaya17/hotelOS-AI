# HotelOS AI

**The AI Intelligence Layer for Hotels**

מערכת הפעלה למלונות (Turbo OS) — שכבת אינטליגנציה ו־AI מעל תפעול הרשת, המלון והאורח.  
שלוש אפליקציות נפרדות, כל אחת עם כתובת משלה; Backend משותף אחד.

## האפליקציות

| אפליקציה | רמה | תפקיד | כתובת מקומית |
|-----------|------|--------|----------------|
| **Executive** | רשת / אזור | לוח בקרה Multi-Hotel, Turbo OS, בריפינגים | http://localhost:5173 |
| **Admin** | מלון בודד | חדרים, הזמנות, נוכחות מהטלפון | http://localhost:5174 |
| **Guest** | אורח | חיפוש שהייה + מסמכי Legal | http://localhost:5175 |
| **API** | שרת | Auth, תפעול, Turbo, Trust, סוכנים | http://localhost:3001 |

הרשת יכולה לכלול כמה בתי מלון. ה־Executive נשאר ברמת הרשת; ה־Admin עובד על מלון אחד (כולל דיפ־לינק `?hotelId=` מה־Executive).

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

קטלוג מתוך Engineering Standard (Vol. 11), כולל: CEO, CFO, Revenue, Housekeeping, Reception, HR, Marketing, Guest, Concierge, Analytics, Sales ועוד.  
ניתן לשתף סוכן לתוך חדר בריפינג (למשל ועדת כספים + סוכן CFO).

דמו מוכן: **ועדת כספים — רבעון נוכחי**.

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

כפתור **המשך עם Google (צוות)** — דמו ללא `GOOGLE_CLIENT_ID` (מקשר זהות ומנפיק סשן למשתמש קיים). עם מפתחות אמיתיים: `GET /v1/trust/oauth/google/start`.

### אורח (Guest)

אימייל דמו: `noa@example.com`  
מסמכי חוק: `http://localhost:5175/?doc=terms|cookies|security|privacy`

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
  web-client/    # לקוח API משותף
  ui/            # עיצוב / קומפוננטות (+ CookieBanner, SignaturePad)
  database/      # SQLite + Drizzle + seed
  auth/          # JWT + סיסמאות
  shared/ config/ validation/ logger/
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

CORS: מקורות ב־`CORS_ORIGINS` (ברירת מחדל — שלוש האפליקציות המקומיות).

## פריסה (Deployment)

הפרויקט מוכן לפריסה ל-Vercel — **4 פרויקטים נפרדים** (executive/admin/guest/api), כל אחד בנפרד מאותו ה-repo, עם דומיין משלו.
מדריך מלא: [`docs/deployment/vercel.md`](docs/deployment/vercel.md).

מסד הנתונים בפרודקשן עבר מ-`better-sqlite3` המקומי ל-`libSQL`/`Turso` (Vercel לא תומך בדיסק קבוע) —
פרטים ב-[`docs/adr/0006-libsql-turso-hosted-db.md`](docs/adr/0006-libsql-turso-hosted-db.md).
פיתוח מקומי (`pnpm dev`) לא השתנה.

## תיעוד

| מסמך | תוכן |
|--------|------|
| [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) | מפרט הנדסי מחייב |
| [`docs/engineering-standard/11-ai-agents/`](docs/engineering-standard/11-ai-agents/) | קטלוג סוכנים |
| [`docs/adr/0003-three-separate-apps.md`](docs/adr/0003-three-separate-apps.md) | שלוש אפליקציות נפרדות |
| [`docs/adr/0004-turbo-os-i18n-automations.md`](docs/adr/0004-turbo-os-i18n-automations.md) | Turbo OS, i18n, אוטומציות |
| [`docs/adr/0005-trust-compliance-attendance.md`](docs/adr/0005-trust-compliance-attendance.md) | Trust, Google, נוכחות |
| [`docs/adr/0006-libsql-turso-hosted-db.md`](docs/adr/0006-libsql-turso-hosted-db.md) | מעבר ל-libSQL/Turso לפריסה |
| [`docs/deployment/vercel.md`](docs/deployment/vercel.md) | מדריך פריסה ל-Vercel |
| [`docs/planning/employee-hr-module.md`](docs/planning/employee-hr-module.md) | תכנון: הרשמה עצמית לעובדים, מבחני יכולת, תעודת יושר |

## רישיון / סטטוס

פרויקט בפיתוח פעיל — foundation + Turbo OS P1.  
מיצוב מוצר: Intelligence Layer תחילה (אינטגרציה / שכבה חכמה), לא rip-and-replace של PMS ביום הראשון.
