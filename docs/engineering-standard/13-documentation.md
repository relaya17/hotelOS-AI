# כרך 13 — Documentation

**Version:** 1.0 (Draft)  
**Owner:** Architecture + Product

---

## 13.1 מדיניות

תיעוד הוא חלק מהמוצר.  
שינוי חוזה בלי עדכון תיעוד = PR לא מאושר.

## 13.2 מסמכים חובה

| סוג | מיקום מתוכנן | מתי |
|-----|----------------|-----|
| Engineering Standard (זה) | `docs/engineering-standard/` | **עכשיו — חוסם קוד** |
| PRD | `docs/prd/` | אחרי אישור כרך 1 |
| SRS | `docs/srs/` | אחרי PRD |
| Architecture | `docs/architecture/` | לפני P1 קוד |
| ADR | `docs/adr/` | לכל החלטה מהותית |
| ERD | `docs/erd/` | לפני מיגרציות |
| UML / Sequence / Activity | `docs/diagrams/` | לפי פיצ'ר |
| OpenAPI | `docs/openapi/` / generated | עם API |
| Deployment Guides | `docs/deploy/` | לפני prod |
| Developer Guide | `docs/dev/` | עם monorepo |
| Contribution Guide | `CONTRIBUTING.md` | עם monorepo |
| User Manuals | `docs/manuals/user/` | לפני GA משטח |
| Administrator Manuals | `docs/manuals/admin/` | לפני GA |
| Runbooks | `docs/runbooks/` | עם on-call |
| Security Guide | `docs/security/` | עם כרך 8 |

## 13.3 דיאגרמות

חובה לכל יכולת ליבה:

- Sequence diagrams למסעים קריטיים (booking, payment, AI approval)
- ERD per logical DB
- Deployment diagram per environment class (SaaS / Enterprise)

פורמט מועדף: Mermaid ב־Markdown + ייצוא לפי הצורך.

## 13.4 סטנדרט כתיבה

- עברית למסמכי מוצר/מדיניות; אנגלית מותרת ל־API identifiers
- כל מסמך: Version, Status, Owner, תאריך
- שינויים מהותיים ב־CHANGELOG של המסמך

## 13.5 קריטריוני אישור כרך 13

- [ ] רשימת מסמכי חובה מאושרת
- [ ] ADR process מאושר
- [ ] אין קוד לפני השלמת/אישור ה־Engineering Standard
