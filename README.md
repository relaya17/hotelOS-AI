# HotelOS AI

**The AI Intelligence Layer for Hotels** — קודם מחברים ומחכימים מערכות קיימות; אחר כך מרחיבים למודולי HotelOS.

## סטטוס

| שלב | סטטוס |
|-----|--------|
| Engineering Standard v1.0 | ✅ מאושר |
| Foundation (auth, DB, admin UI) | ✅ פעיל |

מפרט מחייב: [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md)

## הרצה מקומית

```bash
pnpm install
pnpm typecheck
pnpm dev
```

- API: http://localhost:3001/health  
- Admin: http://localhost:5173  

### משתמש דמו

| שדה | ערך |
|-----|------|
| Tenant ID | `11111111-1111-4111-8111-111111111111` |
| Email | `admin@demo.hotelos.local` |
| Password | `HotelOS-Demo-ChangeMe1!` |

## מבנה

```
apps/
  api/              # Hono API — Clean Architecture
  admin/            # Vite + React 19 — RTL + Design System

packages/
  ui/               # tokens, Fraunces/Figtree + Frank Ruhl Libre/Heebo
  auth/             # tenancy, scrypt passwords, JWT, login use-case
  database/         # SQLite + Drizzle repos (tenancy, sessions, audit)
  config/ shared/ validation/ logger/
```

## איכות

- TypeScript strict (`noImplicitAny`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`…)
- אין `any`
- Validation עם Zod בכל קלט API
- Refresh token rotation + audit על login
- בדיקות unit ל־auth / database / domain

## חוק הזהב

כל קוד חדש חייב לעמוד ב־100% ב־Engineering Standard.
