# כרך 4 — Accessibility Standard

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Accessibility Lead  
**יעד:** WCAG 2.2 AA (חובה) · שאיפה ל־AAA במקומות מעשיים

---

## 4.1 מדיניות

נגישות היא דרישת ליבה — לא "שלב מאוחר".  
כל PR שנוגע ב־UI חייב לעבור Accessibility Scan. כישלון = אין Merge (GR-010).

## 4.2 יעדי תאימות

| רמה | סטטוס |
|-----|--------|
| WCAG 2.2 A | חובה מלאה |
| WCAG 2.2 AA | חובה מלאה |
| WCAG 2.2 AAA | יעד במסכים ליבה — ראו רשימה סגורה ב־§4.2.1 |

### 4.2.1 מסכי עדיפות AAA (החלטת PO, 2026-07-18)

רשימה סגורה של מסכים שבהם היעד הוא **WCAG 2.2 AAA** (מעל ה־AA החוסם), כי הם נקודות הכניסה/משימות הקריטיות ביותר לכל סוגי המשתמשים כולל בעלי מוגבלויות:

| # | מסך | משטח | הערה |
|---|------|------|------|
| 1 | Login (כל האפליקציות) | Public, Guest, Employee, Admin, Executive | נקודת כניסה יחידה לכולם |
| 2 | Guest stay hub | Guest | מסך הבית של האורח — הזמנות, מפתח, שירותים |
| 3 | Admin dashboard ops | Admin | תפעול יומי קריטי (חדרים, משימות, תקלות) |
| 4 | Attendance clock | Employee, Executive | שעון נוכחות — חובה לכל עובד, כולל בעלי מוגבלויות |
| 5 | Executive portfolio / attention | Executive | KPI + חריגות דורשות תשומת לב מיידית |
| 6 | Cookie banner | Public + כל האפליקציות | חוק/הסכמה — חייב נגישות מלאה לכולם |
| 7 | Briefing meet (חדר בריפינג) | Executive | פגישות קריטיות להנהלה, כולל הקלטה/תמלול |

מסכים אלה מחייבים: ניגודיות AAA (7:1 טקסט רגיל), ניווט מקלדת מלא + בדיקת SR ידנית בכל release, ותמיכה מלאה ב־`prefers-reduced-motion` ו־font scaling עד 200%. שאר המסכים נשארים ב־AA חוסם + AAA כשאיפה (לא חוסם).

## 4.3 Keyboard Navigation

- כל פעולה זמינה במקלדת
- סדר focus הגיוני
- Shortcuts מתועדים ב־Command Palette / עזרה
- אין מלכודות מקלדת (keyboard traps)

## 4.4 Screen Readers

- סמנטיקה נכונה (`nav`, `main`, `header`, `table`, headings)
- `aria-*` רק כשסמנטיקה טבעית לא מספיקה
- Live regions להתראות חשובות (בלי spam)
- בדיקות עם לפחות NVDA או VoiceOver למסכי ליבה בכל release משמעותי

## 4.5 Voice Navigation

- תוויות כפתורים/קישורים ייחודיות וברורות
- אין להסתמך על מיקום ויזואלי בלבד
- תמיכה בפעולות קוליות ב־Guest/Employee דרך שכבת AI — עם תמלול נגיש ואישור פעולות מסוכנות

## 4.6 Focus Management

- Focus indicators נראים תמיד (לא `outline: none` בלי תחליף)
- בניווט SPA: העברת focus לכותרת/אזור ראשי אחרי מעבר מסך
- Modals: focus trap + חזרה לאלמנט שפתח
- Skip links לתוכן המרכזי

## 4.7 High Contrast

- ערכת High Contrast או תאימות ל־forced-colors
- בדיקת contrast לכל זוג טקסט/רקע סמנטי

## 4.8 Reduced Motion

- כיבוד `prefers-reduced-motion`
- חלופה סטטית לאנימציות מהותיות

## 4.9 Font Scaling

- תמיכה בהגדלת טקסט לפחות עד 200% בלי חיתוך תוכן ליבה
- אין טקסט כתמונה למידע חיוני

## 4.10 Accessible Charts

- חלופת טבלה/טקסט לכל גרף
- תיאור מגמה (`aria` / summary)
- לא צבע בלבד להבחנה בין סדרות

## 4.11 Accessible Tables

- `<th>` עם `scope` / headers
- מיון/סינון נגישים מהמקלדת
- Virtualization לא ישבור קריאת כותרות
- Admin DataGrid: הודעות ל־SR על שינוי מיון/עמוד

## 4.12 טפסים

- Label מפורש לכל שדה
- שגיאות מקושרות לשדה (`aria-describedby`)
- הודעות שגיאה בשפה ברורה + i18n
- אין להסתמך על placeholder כתווית

## 4.13 בדיקות חובה

| סוג | כלי/שיטה | מתי |
|-----|----------|-----|
| Automated | axe / equivalent ב־CI | כל PR UI |
| Keyboard walkthrough | ידני | מסכי ליבה לשינוי |
| SR smoke | ידני | לפני release |
| Contrast | automated + design review | שינוי tokens |

## 4.14 הצהרת נגישות

חובה לפרסם Accessibility Statement (כרך 12 + Footer כרך 3) ולעדכן בכל release מרכזי.

## 4.15 קריטריוני אישור כרך 4

- [x] יעד WCAG 2.2 AA מאושר כחוסם
- [x] רשימת מסכי ליבה ל־AAA מוגדרת (§4.2.1)
- [x] CI accessibility scan מאושר כחלק מ־PR Gate

> אושר על ידי Product Owner ב־2026-07-18.
