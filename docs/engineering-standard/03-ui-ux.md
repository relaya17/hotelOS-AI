# כרך 3 — UI/UX Standard

**Version:** 1.0 (Draft)  
**Owner:** Design System Lead

---

## 3.1 מטרה

חוויית משתמש אחידה בכל משטחי HotelOS AI: Public, Guest, Employee, Admin, Executive — Web + Mobile.

## 3.2 Design System

- מקור אמת יחיד: `packages/ui`
- Tokens: color, typography, spacing, radius, elevation, motion, z-index
- אין ערכי צבע/ריווח "חופשיים" ב־apps — רק tokens
- גרסאות Design System עם changelog; שבירת API של קומפוננטה = Major

## 3.3 Component Library

חובה לכלול לפחות:

- Layout: AppShell, Sidebar, Header, MegaMenu, Breadcrumbs, Footer
- Navigation: Tabs, Command Palette, Quick Actions
- Data: Table, DataGrid (accessible), List, VirtualList
- Feedback: Toast, Dialog, Banner, Skeleton, EmptyState, ErrorState
- Forms: TextField, Select, DateRange, MoneyInput, FileUpload
- AI: AgentMessage, ApprovalCard, ConfidenceHint, CitationList

כל קומפוננטה ציבורית: Storybook + a11y checks + RTL snapshot.

## 3.4 Typography

- פונטים ייעודיים למותג (לא Inter/Roboto/Arial כברירת מחדל למוצר ממותג)
- סקאלה: `display` / `h1–h6` / `body` / `label` / `caption`
- תמיכה ב־font scaling לנגישות (כרך 4)
- עברית + לטינית: בדיקת fallback ו־line-height דו־כיווני

## 3.5 Color System

- Palettes סמנטיות: `brand`, `neutral`, `success`, `warning`, `danger`, `info`
- Contrast לפי WCAG 2.2 AA מינימום
- אין להסתמך על צבע בלבד למשמעות (אייקון/טקסט נלווים)

## 3.6 Dark Mode

- תמיכה מלאה מ־v1 ב־Admin / Employee / Executive
- Guest/Public: לפי מיתוג + העדפת מערכת
- Tokens נפרדים ל־light/dark; לא hardcode

## 3.7 RTL / LTR

- i18n direction לפי שפה
- Logical properties (`margin-inline`, `inset-inline-start`) במקום left/right קשיח
- בדיקות חובה בעברית (RTL) ובאנגלית (LTR) לכל מסך ליבה

## 3.8 Responsive — Mobile First

Breakpoints מחייבים:

| Name | Min width | שימוש |
|------|-----------|--------|
| phone | 0 | ברירת מחדל |
| tablet | 768px | |
| laptop | 1024px | |
| desktop | 1280px | |
| ultraWide | 1600px+ | Executive dashboards |

### Responsive Grid

- 4 / 8 / 12 columns לפי breakpoint
- Spacing system מבוסס סקאלה (למשל 4px base): 0,1,2,3,4,6,8,12,16…

## 3.9 Navigation Patterns

חובה לתמוך ב־:

Header · Mega Menu (Admin) · Sidebar · Breadcrumbs · Search · Footer · Quick Actions · **Command Palette** (Admin/Executive)

### Footer (Public / Legal surfaces)

חייב לכלול קישורים ל:

תנאי שימוש · מדיניות פרטיות · Cookies · הצהרת נגישות · יצירת קשר · תמיכה · FAQ · Sitemap · Careers · API · Status · Security · Cookie Settings · Legal

## 3.10 Animation Rules

- Motion להדגשת היררכיה ונוכחות — לא רעש
- משך קצר ועקבי (tokens)
- כיבוד `prefers-reduced-motion` (כרך 4)
- אסור אנימציות שחוסמות משימה או מעלות layout shift משמעותי

## 3.11 מצבי מערכת UI

כל מסך נתונים חייב להגדיר:

| מצב | דרישה |
|-----|--------|
| Loading | Skeleton תואם מבנה — לא spinner כללי כברירת מחדל ברשימות |
| Empty | הסבר + CTA ברור |
| Error | הודעה פעולה אפשרית (retry / support) |
| Partial / Stale | סימון נתונים לא מעודכנים (esp. Executive/AI) |

## 3.12 AI UX Rules

- הבחנה ויזואלית בין תוכן אנושי ל־AI
- הצגת מקור/ציטוט כשיש RAG
- פעולות שדורשות אישור אנושי → Approval UI מפורש
- אין להציג AI כ"עובדה ודאית" בלי סימון ביטחון/הסבר כשנדרש (כרך 5)

## 3.13 App-specific UX Notes

### Guest
מסע קצר, פעולות גדולות, offline חלקי להודעות/בקשות

### Employee
משימות מהירות, מצלמה/תמונות, offline-first חזק

### Admin
צפיפות מידע מבוקרת, טבלאות נגישות, Command Palette

### Executive
KPI בזמן אמת, שאלות בשפה טבעית, התראות Push AI — לא עומס וידג'טים

## 3.14 קריטריוני אישור כרך 3

- [ ] Design tokens מאושרים
- [ ] רשימת קומפוננטות ליבה מאושרת
- [ ] RTL + Dark Mode כחובה
- [ ] מצבי Loading/Empty/Error מחייבים
