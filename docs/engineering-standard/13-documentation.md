# כרך 13 — Documentation

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Architecture + Product

---

## 13.1 מדיניות

תיעוד הוא חלק מהמוצר.  
שינוי חוזה בלי עדכון תיעוד = PR לא מאושר.

## 13.2 מסמכים חובה

| סוג | מיקום מתוכנן | מתי | סטטוס נוכחי (2026-07-18) |
|-----|----------------|-----|---------------------------|
| Engineering Standard (זה) | `docs/engineering-standard/` | **עכשיו — חוסם קוד** | ✅ Approved v1.0 |
| PRD | `docs/prd/` | אחרי אישור כרך 1 | ✅ [hotelos-v1.md](../prd/hotelos-v1.md) |
| SRS | `docs/srs/` | אחרי PRD | ✅ [hotelos-v1.md](../srs/hotelos-v1.md) |
| Architecture | `docs/architecture/` | לפני P1 קוד | ✅ [system-overview.md](../architecture/system-overview.md) |
| ADR | `docs/adr/` | לכל החלטה מהותית | ✅ פעיל — ראה [README](../adr/README.md) |
| ERD | `docs/erd/` | לפני מיגרציות | ✅ [hotel-core.md](../erd/hotel-core.md) |
| UML / Sequence / Activity | `docs/diagrams/` | לפי פיצ'ר | ✅ [guest-check-in-sequence.md](../diagrams/guest-check-in-sequence.md) |
| OpenAPI | `docs/openapi/` | עם API | ✅ [inventory README](../openapi/README.md) |
| Deployment Guides | `docs/deployment/` | לפני prod | ✅ `vercel.md` |
| Developer Guide | `docs/dev/` | עם monorepo | ✅ [README](../dev/README.md) |
| Contribution Guide | `CONTRIBUTING.md` | עם monorepo | ✅ שורש הריפו |
| User Manuals | `docs/manuals/user/` | לפני GA משטח | ✅ [guest.md](../manuals/user/guest.md) |
| Administrator Manuals | `docs/manuals/admin/` | לפני GA | ✅ [staff.md](../manuals/admin/staff.md) |
| Runbooks | `docs/runbooks/` | עם on-call | ✅ ראה [README](../runbooks/README.md) |
| Security Guide | `docs/security/` | עם כרך 8 | ✅ [README](../security/README.md) |

> **עדכון 2026-07-18 (PO):** כל סוגי המסמכים בטבלה מולאו בתוכן v1 — אין עוד stubs ריקים.

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

- [x] רשימת מסמכי חובה מאושרת
- [x] ADR process מאושר
- [x] אין קוד לפני השלמת/אישור ה־Engineering Standard
- [x] נתיב Deployment Guides מתוקן ל־`docs/deployment/`
- [x] PRD / SRS / Architecture / ERD / Diagrams / OpenAPI / Dev / Manuals / Runbooks / Security מולאו ל־v1

> אושר על ידי Product Owner ב־2026-07-18; השלמת תוכן מלא באותו יום לפי בקשת PO.
