# HotelOS AI

**The AI Intelligence Layer for Hotels**

שלוש אפליקציות נפרדות — כל אחת עם כתובת משלה.

## האפליקציות

| אפליקציה | תפקיד | כתובת מקומית |
|-----------|--------|----------------|
| **Executive** | לוח בקרה לרשת (Multi-Hotel) | http://localhost:5173 |
| **Admin** | תפעול מלון (חדרים + הזמנות) | http://localhost:5174 |
| **Guest** | אפליקציית אורחים | http://localhost:5175 |
| **API** | Backend משותף | http://localhost:3001 |

הרשת יכולה לכלול כמה בתי מלון — ה־Executive מציג את כולם ברמת הרשת; ה־Admin עובד על מלון אחד בבחירה.

## הרצה

```bash
pnpm install
pnpm typecheck
pnpm dev
```

### התחברות צוות (Executive / Admin)

- Email: `admin@demo.hotelos.local`
- Password: `HotelOS-Demo-ChangeMe1!`

### אורח (Guest)

נסו אימייל דמו: `noa@example.com`

## מבנה

```
apps/
  executive/   # רמת רשת
  admin/       # רמת מלון
  guest/       # אורחים
  api/

packages/
  web-client/  # לקוח API משותף לשלוש האפליקציות
  ui/ auth/ database/ …
```

מפרט מחייב: [`docs/engineering-standard/00-INDEX.md`](docs/engineering-standard/00-INDEX.md)
