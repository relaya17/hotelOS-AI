# HotelOS AI

**The AI Intelligence Layer for Hotels**

מערכת הפעלה למלונות (Turbo OS) — שכבת אינטליגנציה ו־AI מעל תפעול הרשת, המלון והאורח.  
שלוש אפליקציות נפרדות, כל אחת עם כתובת משלה; Backend משותף אחד.

## האפליקציות

| אפליקציה | רמה | תפקיד | כתובת מקומית |
|-----------|------|--------|----------------|
| **Executive** | רשת / אזור | לוח בקרה Multi-Hotel, Turbo OS, בריפינגים | http://localhost:5173 |
| **Admin** | מלון בודד | חדרים, הזמנות, תפעול יומי | http://localhost:5174 |
| **Guest** | אורח | חיפוש שהייה לפי אימייל | http://localhost:5175 |
| **API** | שרת | Auth, תפעול, Turbo, סוכנים | http://localhost:3001 |

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

### אורח (Guest)

אימייל דמו: `noa@example.com`

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
  web-client/    # לקוח API משותף
  ui/            # עיצוב / קומפוננטות
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
| `POST /v1/public/stays/lookup` | חיפוש שהייה לאורח |

CORS: מקורות ב־`CORS_ORIGINS` (ברירת מחדל — שלוש האפליקציות המקומיות).

## תיעוד

| מסמך | תוכן |
|--------|------|
| [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md) | מפרט הנדסי מחייב |
| [`docs/engineering-standard/11-ai-agents/`](docs/engineering-standard/11-ai-agents/) | קטלוג סוכנים |
| [`docs/adr/0003-three-separate-apps.md`](docs/adr/0003-three-separate-apps.md) | שלוש אפליקציות נפרדות |
| [`docs/adr/0004-turbo-os-i18n-automations.md`](docs/adr/0004-turbo-os-i18n-automations.md) | Turbo OS, i18n, אוטומציות |

## רישיון / סטטוס

פרויקט בפיתוח פעיל — foundation + Turbo OS P1.  
מיצוב מוצר: Intelligence Layer תחילה (אינטגרציה / שכבה חכמה), לא rip-and-replace של PMS ביום הראשון.
