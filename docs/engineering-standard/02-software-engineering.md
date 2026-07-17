# כרך 2 — Software Engineering Standard

**Version:** 1.0 (Draft)  
**Owner:** Chief Architect  
**זהו "החוק" של כל המפתחים.**

---

## 2.1 TypeScript — חוקים מחייבים

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "useUnknownInCatchVariables": true
  }
}
```

| כלל | סטטוס |
|-----|--------|
| `any` | **אסור** |
| `unknown` + narrowing | חובה כשסוג לא ידוע |
| Generics | מועדף לחוזים לשימוש חוזר |
| Discriminated Unions | מועדף למצבים/אירועים |
| Enums | רק כשיש הצדקה; אחרת Union Types |
| `@ts-ignore` / `@ts-expect-error` | אסור ללא ADR + תוקף הסרה |

## 2.2 עקרונות עיצוב

חובה ליישם ולהגן ב־Review:

- **SOLID**
- **DRY** (בלי abstractions מוקדמות)
- **KISS**
- **YAGNI**
- **Domain Driven Design** (Bounded Contexts לפי תחומי המלון)
- **CQRS** — רק כאשר יש הצדקה (קריאה כבדה / מודלים שונים)
- **Repository Pattern**
- **Service Layer**
- **Dependency Injection**
- **Feature-Based Architecture**
- **Hexagonal Architecture** — לרכיבים המתאימים (AI, Payments, Locks)

## 2.3 Clean Architecture

```
Presentation  →  Application  →  Domain  ←  Infrastructure
```

- Domain: entities, value objects, domain services, domain events — **ללא** React / HTTP / DB / LLM
- Application: use cases / commands / queries
- Infrastructure: DB, queues, email, LLM providers, lock vendors
- Presentation: HTTP controllers, UI, CLI

## 2.4 מבנה Monorepo

```
apps/
  web-public/
  guest/
  employee/
  admin/
  executive/
  api/
  ai/
  worker/

packages/
  ui/
  auth/
  database/
  ai/
  shared/
  validation/
  logger/
  config/
  email/
  storage/
  payments/
  notifications/
  booking/
  billing/
  housekeeping/
  maintenance/
```

### Folder Convention (Feature-based בתוך app/package)

```
feature-name/
  domain/
  application/
  infrastructure/
  presentation/
  index.ts
```

## 2.5 זרימת תלויות שכבות

```
Controller → Service → Repository → Database
```

אסור:

- SQL/ORM ישיר ב־Controller
- לוגיקת דומיין ב־React components
- קריאת LLM מ־Service עסקי (רק דרך AI Gateway port)

## 2.6 Validation

- Zod לכל קלט חיצוני (HTTP, queue, webhook, AI tool args)
- DTOs בגבולות המערכת
- Sanitization / Escape לפי הקשר (HTML, SQL parameterized, logs redaction)

## 2.7 Naming Convention

| סוג | כלל | דוגמה |
|-----|-----|--------|
| Files (TS) | kebab-case | `create-booking.ts` |
| Types/Interfaces | PascalCase | `BookingStatus` |
| Functions | camelCase, verb | `confirmCheckIn` |
| Constants | UPPER_SNAKE או as const object | `MAX_ROOMS` |
| DB tables | snake_case plural | `bookings` |
| React components | PascalCase | `RoomStatusBadge` |
| Features/packages | kebab-case | `housekeeping` |

שמות בעברית **אסורים** בקוד; מותרים במסמכים ובמחרוזות i18n.

## 2.8 Import Convention

1. Node / חיצוני  
2. `@hotelos/*` packages  
3. יחסי (`./` `../`) — רק בתוך אותו feature  
4. אסור deep-import מתוך internals של package אחר — רק דרך `index` ציבורי  
5. אסור circular dependencies (נחסם ב־CI)

## 2.9 Error Convention

- Domain errors טיפוסיים (Discriminated Union / class hierarchy)
- מיפוי ל־API error codes בכרך 7
- אין לבלוע שגיאות בשקט
- `unknown` ב־catch + narrowing
- הודעות משתמש דרך i18n keys — לא מחרוזות קשיחות בלוגיקה

## 2.10 Logging Convention

רמות: `debug` | `info` | `warn` | `error` | `critical` + **audit** נפרד

חובה בכל לוג מערכתי:

- `timestamp`, `level`, `service`, `tenantId`, `hotelId` (אם רלוונטי), `requestId` / `correlationId`
- אין PII מלא בלוגים רגילים (כרטיס אשראי, סיסמאות, tokens) — redaction חובה

## 2.11 Security Convention (תמצית)

ראה כרך 8. בקוד:

- Secrets רק מ־Secret Manager / env מוזרק — לא ב־repo
- AuthZ בכל use case (לא רק ב־UI)
- Least privilege ל־service identities

## 2.12 Code Style

- פונקציות קצרות, אחריות אחת
- DI במקום `new` ישיר לתלויות חיצוניות
- אין Magic Numbers/Strings — constants / enums / unions מתועדים
- Interfaces/Types כחוזים בין שכבות
- JSDoc לפונקציות ציבוריות מורכבות ב־packages משותפים

## 2.13 Frontend Stack (מחייב ל־v1)

| נושא | בחירה |
|------|--------|
| UI lib | React 19 |
| Language | TypeScript strict |
| Bundler (web) | Vite |
| Server state | TanStack Query |
| Client state | Redux Toolkit (רק כשצריך global) |
| Forms | React Hook Form + Zod |
| Components | MUI + `packages/ui` Design System |
| i18n | RTL + LTR |
| A11y | כרך 4 |

## 2.14 Performance (הנדסה)

Lazy Loading · Code Splitting · Virtualization לרשימות גדולות · Caching · CDN · Image Optimization · Compression · Background Jobs · Queue Processing

## 2.15 ADR

כל החלטה ארכיטקטונית מהותית → `docs/adr/NNNN-title.md`  
תבנית: Context · Decision · Consequences · Status · Alternatives

## 2.16 Code Review + PR Checklist

### חובה לפני Review

- [ ] עומד ב־Golden Rules
- [ ] אין `any`
- [ ] Validation בגבול
- [ ] הרשאות AuthZ
- [ ] בדיקות רלוונטיות
- [ ] i18n keys לטקסט משתמש
- [ ] אין סודות
- [ ] ADR אם נדרש
- [ ] עדכון OpenAPI / ERD אם החוזה השתנה

### PR Checklist (חוסם)

- [ ] Type Check
- [ ] Lint
- [ ] Unit Tests
- [ ] Integration Tests (אם נגע בגבולות)
- [ ] Build
- [ ] Security Scan
- [ ] Dependency Scan
- [ ] Secret Scan
- [ ] Accessibility Scan (UI)
- [ ] Performance Budget (UI)

אם אחד נכשל — **אין Merge**.

## 2.17 קריטריוני אישור כרך 2

- [ ] TypeScript rules מאושרים
- [ ] מבנה Monorepo מאושר
- [ ] Clean Architecture + patterns מאושרים
- [ ] PR Gate מאושר כחוסם
