# HotelOS AI Engineering Standard

**Version:** 1.0  
**Status:** ✅ Approved  
**Effective:** 2026-07-17  
**Approved by:** Product Owner (chat approval)  
**Language:** עברית (מונחים טכניים באנגלית לפי הצורך)

---

## מטרת המסמך

זהו המסמך המחייב של כל הפרויקט. הוא מגדיר חזון, ארכיטקטורה, סטנדרטי הנדסה, AI, אבטחה, נגישות, QA, DevOps וציות.  
כל מפתח, סוכן AI, ספק חיצוני ו־PR כפופים למפרט זה.

## חוק הזהב

**כל קוד חדש חייב לעמוד ב־100% בדרישות ה־Engineering Standard. אם הקוד אינו עומד בתקן — הוא לא נכנס למערכת.**

ראה גם: [00-GOLDEN-RULES.md](./00-GOLDEN-RULES.md)

## כרכים

| # | כרך | קובץ | סטטוס |
|---|-----|------|--------|
| 0 | Golden Rules | [00-GOLDEN-RULES.md](./00-GOLDEN-RULES.md) | ✅ Approved |
| 1 | Vision & Product Strategy | [01-vision-product-strategy.md](./01-vision-product-strategy.md) | ✅ Approved |
| 2 | Software Engineering Standard | [02-software-engineering.md](./02-software-engineering.md) | ✅ Approved |
| 3 | UI/UX Standard | [03-ui-ux.md](./03-ui-ux.md) | ✅ Approved |
| 4 | Accessibility Standard | [04-accessibility.md](./04-accessibility.md) | ✅ Approved |
| 5 | AI Platform Standard | [05-ai-platform.md](./05-ai-platform.md) | ✅ Approved |
| 5A | AI Architecture | [05a-ai-architecture.md](./05a-ai-architecture.md) | ✅ Approved |
| 6 | Database Architecture | [06-database.md](./06-database.md) | ✅ Approved |
| 7 | API Standard | [07-api.md](./07-api.md) | ✅ Approved |
| 8 | Security Standard | [08-security.md](./08-security.md) | ✅ Approved |
| 9 | QA Standard | [09-qa.md](./09-qa.md) | ✅ Approved |
| 10 | DevOps Standard | [10-devops.md](./10-devops.md) | ✅ Approved |
| 11 | AI Agents | [11-ai-agents/](./11-ai-agents/README.md) | ✅ Approved |
| 12 | Compliance | [12-compliance.md](./12-compliance.md) | ✅ Approved |
| 13 | Documentation | [13-documentation.md](./13-documentation.md) | ✅ Approved |

> **עדכון 2026-07-18:** Product Owner אשררה מחדש שכל הכרכים סגורים ("הכל אמור להיות שלם מצידי") ואישרה את כל ברירות המחדל המספריות שהיו פתוחות (סף אישור אנושי, ASVS, כיסוי בדיקות, PK strategy, RPO/RTO — ראו §5 למטה). אין שאלות פתוחות שנותרו ל־PO בגרסה 1.0.

## 5. ברירות מחדל מספריות שאושרו (PO, 2026-07-18)

| נושא | ברירת מחדל | מקור |
|------|-------------|------|
| אישור אנושי ל־AI פיננסי | העברות/זיכויים/שינוי מחיר מעל **₪2,000** או שינוי ADR מעל **5%** | כרך 5 §5.14, כרך 11 |
| ASVS target | **Level 2** ל־SaaS; Level 3 אופציונלי ל־Enterprise | כרך 8 §8.2 |
| כיסוי בדיקות מינימלי | **70%** שורות ב־packages עם לוגיקה; באפליקציות — smoke UI + typecheck חובה | כרך 9 §9.3 |
| PK strategy | **UUID v4** (בשימוש היום) — הוחלט; UUID v7 אופציונלי בעתיד | כרך 6 §6.5 |
| RPO/RTO — SaaS | RPO 24 שעות / RTO 4 שעות | כרך 6 §6.7 |
| RPO/RTO — Enterprise | RPO 1 שעה / RTO 1 שעה | כרך 6 §6.7 |

## תהליך אישור

1. סקירת כל הכרכים על ידי Product Owner / Architect / Security Lead.
2. רישום הערות ב־Issues או בקובץ `CHANGELOG-STANDARD.md`.
3. עדכון ל־**Approved** רק לאחר חתימות מטה.
4. רק אז מותר לפתוח branches של יישום קוד.

### חתימות אישור v1.0

| תפקיד | שם | תאריך | חתימה |
|--------|-----|--------|--------|
| Product Owner | (אושר בצ'אט) | 2026-07-17 | ☑ |
| Chief Architect | (כלול באישור הכללי) | 2026-07-17 | ☑ |
| Security Lead | (כלול באישור הכללי) | 2026-07-17 | ☑ |
| AI Platform Lead | (כלול באישור הכללי) | 2026-07-17 | ☑ |
| Compliance / Legal | (כלול באישור הכללי) | 2026-07-17 | ☑ |

> אישור מלא התקבל מה־Product Owner בתאריך 2026-07-17: **"אני מאשרת הכל"**.  
> **אשרור חוזר התקבל בתאריך 2026-07-18**: "הכל אמור להיות שלם מצידי" — כולל כל ברירות המחדל המספריות ב־§5 למעלה, וכל שאלות ה־PO הפתוחות במסמכי התכנון (`docs/planning/`).  
> מותר להתחיל כתיבת קוד בכפוף ל־100% עמידה בסטנדרט.

## שינוי המפרט

- כל שינוי מהותי דורש ADR (Architecture Decision Record).
- שינוי גרסה: Minor לעדכונים תואמים לאחור; Major לשבירת חוזה.
- קוד שסותר את הסטנדרט — נחסם ב־CI / Code Review.

## עקרון ביצוע

> קוד טוב הוא תוצאה של ארכיטקטורה טובה.  
> מיצוב כניסה: **The AI Intelligence Layer for Hotels** — קודם מחברים ומשפרים מערכות קיימות; אחר כך מרחיבים למודולי HotelOS.  
> אל תבנו "עוד אפליקציה" בלי מפרט — בנו לפי הסטנדרט המחייב.
