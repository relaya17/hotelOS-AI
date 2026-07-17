# תכנון — מודול תפעול ורכש: תיקונים, שיפוצים, קבלנים, מלאי, פידבק אורחים ודשבורד ידע להנהלה

**סטטוס:** טיוטה לתכנון (טרם יישום)
**תאריך:** 2026-07-17

## רקע ומטרה

בדיקה של המודל הקיים (`packages/database/src/schema`) מראה שאין כרגע שום תשתית לתחזוקה, רכש, קבלנים, מלאי או פידבק אורחים — כל אלה מודול חדש לגמרי. המטרה: לתת לכל **מנהל מלון** מעקב מלא אחרי הזמנות רכש, תיקונים, שיפוצים, הצעות מחיר מקבלנים, בריכה ומגבות/מלאי כללי — ולתת **להנהלה הראשית (רמת רשת)** דשבורד/חיפוש מאוחד שרואה את כל זה על פני כל המלונות ברשת, כולל פידבק לקוחות.

היתרון הגדול: המודל הקיים כבר תומך במדויק בהפרדה הזו — `hotelChains` → `hotels`, וטבלת `users` כבר כוללת `chainId` ו-`hotelId` נפרדים (משתמש עם `hotelId` = מנהל מלון בודד; משתמש עם `chainId` בלבד וללא `hotelId` = הנהלה ברמת רשת). לא צריך לשנות את מודל ההרשאות הבסיסי — רק להשתמש בו.

זהו מסמך תכנון בלבד — לא מתחילים לכתוב קוד עד לאישור.

## עקרון מארגן: "קריאת שירות" מרכזית אחת

כדי לא לבנות טבלה נפרדת לתיקון/שיפוץ/בריכה/מגבות, כל אלה הם `category` בתוך טבלה גנרית אחת — `maintenance_requests` ("קריאת שירות"). זה מקביל בדיוק לעיקרון שהופעל במודל העובדים (`employee_documents` הגנרי).

## יכולת 1 — קריאות שירות: תיקונים, שיפוצים, בריכה, מלאי כללי

### זרימה מוצעת

1. מנהל/עובד יוצר קריאת שירות: מלון, קטגוריה (`repair` / `renovation` / `pool` / `linen` / `general`), כותרת, תיאור, עדיפות, תאריך יעד.
2. אם צריך גורם חיצוני — מקושרת בקשת הצעת מחיר מקבלן (יכולת 2).
3. סטטוס עובר: `open` → `quote_requested` → `approved` → `in_progress` → `done` (או `cancelled`).
4. תמונות לפני/אחרי לתיעוד.

### מודל נתונים

**`maintenance_requests`:**
```
id, tenant_id, hotel_id, department_id (nullable),
category (repair|renovation|pool|linen|general),
title, description, priority (low|medium|high|urgent),
status (open|quote_requested|approved|in_progress|done|cancelled),
created_by_user_id, assigned_to_user_id (nullable), vendor_id (nullable),
due_at, sla_hours, estimated_cost, actual_cost,
created_at, updated_at, closed_at
```

**`maintenance_request_photos`:**
```
id, maintenance_request_id, phase (before|after|general),
storage_key, uploaded_by_user_id, created_at
```

אירועי סטטוס/היסטוריה — משתמשים בטבלת `audit_events` הקיימת (`resource_type: "maintenance_request"`), בלי טבלה חדשה.

### API (טיוטה)

| נתיב | תיאור |
|---|---|
| `POST /v1/ops/maintenance-requests` | יצירת קריאת שירות |
| `GET /v1/ops/maintenance-requests` | רשימה (סינון: מלון/קטגוריה/סטטוס/עדיפות) |
| `PATCH /v1/ops/maintenance-requests/:id` | עדכון סטטוס/שיוך |
| `POST /v1/ops/maintenance-requests/:id/photos` | העלאת תמונה (multipart, כמו הקלטות בריפינג) |

## יכולת 2 — קבלנים/ספקים + הצעות מחיר

### זרימה מוצעת

מאגר קבלנים/ספקים לכל מלון (או משותף לרשת). כשקריאת שירות דורשת גורם חיצוני, מבקשים הצעת מחיר מקבלן אחד או יותר; המנהל בוחר ומאשר הצעה.

### מודל נתונים

**`vendors`:**
```
id, tenant_id, hotel_id (nullable — קבלן יכול לשרת כמה מלונות ברשת),
name, category (contractor|supplier|both),
contact_name, phone, email, rating, notes, created_at
```

**`vendor_quotes`:**
```
id, tenant_id, maintenance_request_id (nullable), vendor_id,
amount, currency, valid_until,
status (pending|accepted|rejected|expired),
document_storage_key,  -- קובץ ההצעה הסרוק
submitted_at, decided_by_user_id, decided_at, created_at
```

### API (טיוטה)

| נתיב | תיאור |
|---|---|
| `GET /v1/ops/vendors` | מאגר קבלנים/ספקים |
| `POST /v1/ops/vendors` | הוספת קבלן/ספק |
| `POST /v1/ops/maintenance-requests/:id/quotes` | הוספת הצעת מחיר |
| `POST /v1/ops/quotes/:id/decision` | אישור/דחיית הצעה |

## יכולת 3 — הזמנות רכש + מלאי (מגבות, מצעים, כימיקלים לבריכה)

### מודל נתונים

**`inventory_items`:**
```
id, tenant_id, hotel_id,
category (towels|linens|pool_chemicals|cleaning|amenities|other),
name, unit, current_stock, reorder_threshold, created_at, updated_at
```

**`inventory_transactions`:**
```
id, inventory_item_id, delta, reason (restock|usage|damage|adjustment),
related_purchase_order_id (nullable), created_by_user_id, created_at
```

**`purchase_orders`:**
```
id, tenant_id, hotel_id, vendor_id,
status (draft|sent|confirmed|received|paid|cancelled),
total_amount, currency, expected_delivery_at, received_at,
created_by_user_id, notes, created_at
```

**`purchase_order_items`:**
```
id, purchase_order_id, inventory_item_id (nullable — פריט חד-פעמי שלא במלאי הקבוע),
description, quantity, unit_price, created_at
```

### API (טיוטה)

| נתיב | תיאור |
|---|---|
| `GET /v1/ops/inventory` | מצב מלאי לפי מלון (עם דגל "מתחת לסף") |
| `POST /v1/ops/purchase-orders` | יצירת הזמנת רכש |
| `PATCH /v1/ops/purchase-orders/:id` | עדכון סטטוס (נשלח/אושר/התקבל) |
| `POST /v1/ops/purchase-orders/:id/receive` | קליטת סחורה → מעדכן מלאי אוטומטית |

## יכולת 4 — תקציב מול בפועל (פער שזיהיתי, לא צוין בבקשה המקורית)

**`hotel_budgets`:** `id, tenant_id, hotel_id, period, category, budgeted_amount, currency, created_at`

"בפועל" לא נשמר בטבלה נפרדת — מחושב על ידי סכימת `purchase_orders.total_amount` + `maintenance_requests.actual_cost` לפי מלון/קטגוריה/תקופה. חוסך טבלת "actual" כפולה שצריך לשמור מסונכרנת.

## יכולת 5 — פידבק אורחים (סקר בתוך אפליקציית Guest)

לפי ההחלטה: סקר קצר בתוך ה-Guest app אחרי צ'ק-אאוט.

### מודל נתונים

**`guest_feedback`:**
```
id, tenant_id, hotel_id, booking_id (nullable),
rating (1-5), categories_json (תגיות כמו ניקיון/שירות/בריכה/רעש),
comment, source (guest_app_survey|manual|external_import),
submitted_at, created_at
```

### API (טיוטה)

| נתיב | תיאור |
|---|---|
| `POST /v1/public/feedback` | הגשת סקר (מבוסס טוקן/booking, כמו שאר `/v1/public/*`) |
| `GET /v1/ops/feedback` | רשימת פידבק (סינון מלון/דירוג/קטגוריה) |

**הערה חשובה:** תיוג פידבק לפי קטגוריה (למשל "בריכה") מאפשר לקשר אותו ישירות לקריאות שירות פתוחות מאותה קטגוריה באותו מלון — זה בדיוק הבסיס לדשבורד המאוחד ביכולת 6.

## יכולת 6 — דשבורד/חיפוש מאוחד להנהלה ("גרף הידע")

לא גרף-דאטהבייס במובן הטכני — **דשבורד וחיפוש מאוחד** מעל כל הישויות שלמעלה (קריאות שירות, הצעות מחיר, הזמנות רכש, מלאי, פידבק אורחים), עם היקף ראייה לפי תפקיד:

- **מנהל מלון** (`hotelId` מוגדר ב-`users`) — רואה רק את המלון שלו.
- **הנהלה ראשית / רשת** (`chainId` מוגדר, ללא `hotelId`) — רואה השוואה בין כל מלונות הרשת: כמה קריאות פתוחות בכל מלון, אילו ממתינות לאישור הצעת מחיר, התראות מלאי נמוך, תקציב מול בפועל, ומגמת דירוג פידבק.

### API (טיוטה)

| נתיב | תיאור |
|---|---|
| `GET /v1/ops/search?q=...&hotelId=...` | חיפוש טקסט חופשי חוצה-ישויות (קריאות שירות + הצעות + הזמנות + פידבק) |
| `GET /v1/ops/dashboard?hotelId=...` | KPI-ים למלון בודד |
| `GET /v1/ops/dashboard?chainId=...` | אותם KPI-ים, מצטבר ומושווה על פני כל מלונות הרשת |

## נושאים חוצי-מערכת

### אחסון קבצים
תמונות קריאות שירות והצעות מחיר סרוקות דורשות אחסון קבצים אמיתי — **אותה מגבלה** שכבר תועדה עבור הקלטות בריפינג (`docs/deployment/vercel.md`) ומסמכי עובד (`docs/planning/employee-hr-module.md`). מומלץ לפתור פעם אחת לשלושתם עם פתרון מנוהל (Vercel Blob / S3) לפני פרודקשן.

### הרשאות
המודל הקיים כבר מספיק: `hotelId` מוגדר → תפעול מלון בודד; `chainId` בלבד → הנהלה ברמת רשת. לא נדרש שינוי סכימה ב-`users`, רק אכיפה בשכבת ה-API לפי ההיקף.

### i18n
טופס סקר האורחים חייב לתמוך בכל 10 השפות — האורח יכול להיות בכל שפה, לא רק עברית.

### התראות
מנהל צריך להתריע כשקריאת שירות חורגת מ-SLA או מלאי יורד מתחת לסף. בשלב ראשון מספיק badge/רשימה בתוך האפליקציה; דחיית התראות מייל/פוש לשלב מאוחר יותר.

## סדר עבודה מוצע (Phases)

1. **שלב א׳** — `maintenance_requests` + `vendors`: קריאות שירות בסיסיות, יצירה/רשימה/עדכון סטטוס, מסך תפעול למנהל מלון בודד.
2. **שלב ב׳** — `vendor_quotes` + `purchase_orders` + `inventory_items`/`inventory_transactions`: לולאת הרכש המלאה.
3. **שלב ג׳** — `guest_feedback`: סקר ב-Guest app + מסך צפייה בסיסי.
4. **שלב ד׳** — הדשבורד/חיפוש המאוחד (יכולת 6) — גם ברמת מלון (Admin) וגם ברמת רשת (Executive), כולל השוואה בין מלונות.
5. **שלב ה׳** — אחסון קבצים מנוהל (משותף למודול הזה + מסמכי עובד + הקלטות), `hotel_budgets` ותקציב מול בפועל, התראות.

## שאלות פתוחות להחלטה לפני תחילת כתיבה

- ספי SLA לכל קטגוריה/עדיפות (למשל: תקלת בריכה "דחופה" = לתקן תוך כמה שעות?) — קלט עסקי מהמלונאות, לא החלטה טכנית.
- סכום סף שמעליו הצעת מחיר/הזמנת רכש דורשת אישור הנהלה ראשית (לא רק מנהל מלון)?
- דירוג קבלנים — ידני בלבד, או מחושב אוטומטית מתוצאות עבודות (עמידה בזמנים/תקציב)?
- תזמון סקר האורח — אוטומטי X ימים אחרי צ'ק-אאוט, או שליחה ידנית ע"י הצוות?
- האם הנהלה ברמת רשת יכולה לערוך/לסגור קריאות שירות ישירות, או רק לצפות ולהסלים למנהל המלון?
