# ארבע כתובות — השורש הנכון

| # | תפקיד | Root Directory | דוגמת שם ב־Vercel |
|---|--------|----------------|-------------------|
| 1 | **API** (שרת) | `apps/api` | `hotel-os-ai-api-eight` |
| 2 | הנהלה | `apps/executive` | `hotel-os-ai-executive-eight` |
| 3 | מלון | `apps/admin` | `hotel-os-ai-admin-eight` |
| 4 | אורח | `apps/guest` | `hotel-os-ai-guest-eight` |

## למה זה פותר את CORS / localhost

1. הדפדפן קורא רק ל־**אותו דומיין** של האפליקציה (`/v1/auth/login`).
2. `middleware.ts` ב־Edge מעביר את הבקשה ל־API הנפרד (server-to-server — בלי CORS).
3. שם ה־API נגזר אוטומטית: `…-admin-…` → `…-api-…` (או `HOTELOS_API_ORIGIN`).

## חובה: פרויקט API

בלי פרויקט `#1` שלושת האתרים נטענים אבל Login נכשל.

### API — Environment Variables

- `DATABASE_URL` / `DATABASE_AUTH_TOKEN` (Turso)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `CORS_ORIGINS=https://*.vercel.app`
- `NODEJS_HELPERS=0`

Include files outside root: **On**.

### Frontends

לא חובה `VITE_API_BASE` (נשאר ריק ב־`.env.production`).  
אופציונלי: `HOTELOS_API_ORIGIN=https://hotel-os-ai-api-eight.vercel.app` אם שם ה־API לא תואם את המוסכמה.
