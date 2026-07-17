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
| 0 | Golden Rules | [00-GOLDEN-RULES.md](./00-GOLDEN-RULES.md) | Draft |
| 1 | Vision & Product Strategy | [01-vision-product-strategy.md](./01-vision-product-strategy.md) | Draft |
| 2 | Software Engineering Standard | [02-software-engineering.md](./02-software-engineering.md) | Draft |
| 3 | UI/UX Standard | [03-ui-ux.md](./03-ui-ux.md) | Draft |
| 4 | Accessibility Standard | [04-accessibility.md](./04-accessibility.md) | Draft |
| 5 | AI Platform Standard | [05-ai-platform.md](./05-ai-platform.md) | Draft |
| 5A | AI Architecture | [05a-ai-architecture.md](./05a-ai-architecture.md) | Draft |
| 6 | Database Architecture | [06-database.md](./06-database.md) | Draft |
| 7 | API Standard | [07-api.md](./07-api.md) | Draft |
| 8 | Security Standard | [08-security.md](./08-security.md) | Draft |
| 9 | QA Standard | [09-qa.md](./09-qa.md) | Draft |
| 10 | DevOps Standard | [10-devops.md](./10-devops.md) | Draft |
| 11 | AI Agents | [11-ai-agents/](./11-ai-agents/README.md) | Draft |
| 12 | Compliance | [12-compliance.md](./12-compliance.md) | Draft |
| 13 | Documentation | [13-documentation.md](./13-documentation.md) | Draft |

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
> מותר להתחיל כתיבת קוד בכפוף ל־100% עמידה בסטנדרט.

## שינוי המפרט

- כל שינוי מהותי דורש ADR (Architecture Decision Record).
- שינוי גרסה: Minor לעדכונים תואמים לאחור; Major לשבירת חוזה.
- קוד שסותר את הסטנדרט — נחסם ב־CI / Code Review.

## עקרון ביצוע

> קוד טוב הוא תוצאה של ארכיטקטורה טובה.  
> מיצוב כניסה: **The AI Intelligence Layer for Hotels** — קודם מחברים ומשפרים מערכות קיימות; אחר כך מרחיבים למודולי HotelOS.  
> אל תבנו "עוד אפליקציה" בלי מפרט — בנו לפי הסטנדרט המחייב.
