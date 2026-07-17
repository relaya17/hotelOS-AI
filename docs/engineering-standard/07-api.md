# כרך 7 — API Standard

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** API Architect

---

## 7.1 עקרונות

- API יציב עם Versioning מהיום הראשון
- חוזה ציבורי ב־**OpenAPI 3.1**
- אותם כללי שגיאה/pagination לכל המשטחים
- Webhooks ו־WebSocket הם חלק מהסטנדרט — לא תוספת מאוחרת

## 7.2 סגנונות תעבורה

| סגנון | שימוש |
|--------|--------|
| REST | CRUD / commands עיקריים |
| WebSocket | עדכוני תפעול בזמן אמת (HK board, executive ticks) |
| Webhooks | אירועים החוצה לספקים/לקוחות Enterprise |
| Internal events | בין שירותים (לא חוזה ציבורי) |

## 7.3 Versioning

- URL: `/v1/...`
- גרסה חדשה רק לשבירת חוזה
- Deprecation: הודעה מראש + תאריך sunset מתועד
- Mobile apps חייבים לתמוך ב־N ו־N-1 במשך תקופת מעבר

## 7.4 אימות והרשאות

- JWT Access + Refresh Token Rotation
- Scopes / permissions בטוקן או introspection
- בדיקת AuthZ בשרת לכל endpoint (לא רק UI)
- Service-to-service: mTLS או signed service tokens לפי ADR

## 7.5 Rate Limiting

- Limit לפי identity + tenant + endpoint class
- כותרות סטנדרטיות: `X-RateLimit-Limit/Remaining/Reset`
- תשובת `429` עם `Retry-After`
- AI endpoints: תקציב נפרד (כרך 5)

## 7.6 OpenAPI 3.1

חובה לכל endpoint ציבורי/שותפים:

- תיאור, tags, security schemes
- Schemas מדויקים (ללא `additionalProperties` פרוצים כברירת מחדל)
- דוגמאות
- קודי שגיאה מתועדים
- CI נכשל אם הקוד סוטה מהחוזה (contract tests)

## 7.7 Error Codes

פורמט אחיד:

```json
{
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "i18n_key_or_safe_message",
    "details": {},
    "correlationId": "…"
  }
}
```

| HTTP | שימוש |
|------|--------|
| 400 | Validation |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found (בלי דליפת קיום cross-tenant) |
| 409 | Conflict |
| 422 | Semantic domain error |
| 429 | Rate limit |
| 500 | Unexpected (בלי stack ללקוח) |

## 7.8 Pagination

- Cursor-based כברירת מחדל לרשימות חמות
- Offset רק לרשימות קטנות/אדמין עם הצדקה
- תשובה: `data`, `nextCursor`, `hasMore`

## 7.9 Filtering & Sorting

- Filter: allowlist שדות בלבד
- Sort: allowlist שדות בלבד
- אסור שאילתות חופשיות מהלקוח
- תיעוד אופרטורים ב־OpenAPI

## 7.10 Idempotency

- כל פעולת כתיבה קריטית (תשלום, check-in, webhook ingest) תומכת ב־`Idempotency-Key`
- שמירת תוצאה לחלון זמן מוגדר

## 7.11 Webhooks

- חתימת HMAC
- Retry עם backoff
- Delivery log ב־`notifications_db` / audit
- מפרט אירועים מגרסה

## 7.12 WebSocket

- Auth בתחילת החיבור
- Channels לפי הרשאות hotel/tenant
- Heartbeat + reconnect מדיניות לקוח
- אין לשלוח PII מיותר ב־broadcast

## 7.13 קריטריוני אישור כרך 7

- [x] OpenAPI 3.1 כחוזה מחייב
- [x] Versioning + Error format מאושרים
- [x] Rate limit + Idempotency מאושרים

> אושר על ידי Product Owner ב־2026-07-18.
