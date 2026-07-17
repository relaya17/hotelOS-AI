# כרך 0 — Golden Rules

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Mandatory:** כן — אין חריגות

---

## GR-001 — אישור סטנדרט לפני קוד

HotelOS AI Engineering Standard v1.0 **אושר** ב־2026-07-17 (ראה [00-INDEX.md](./00-INDEX.md)).  
מותר לכתוב קוד אפליקציה רק בכפוף ל־GR-002 (100% compliance).

## GR-002 — 100% Compliance

כל קוד חדש חייב לעמוד ב־100% בדרישות הסטנדרט.  
אם הקוד אינו עומד בתקן — **הוא לא נכנס למערכת** (אין Merge).

## GR-003 — TypeScript Strict בלבד

- `strict: true`
- `noImplicitAny: true`
- `exactOptionalPropertyTypes: true`
- `noUncheckedIndexedAccess: true`
- `useUnknownInCatchVariables: true`
- **אסור `any`** — השתמש ב־`unknown` + narrowing / Generics / Discriminated Unions

## GR-004 — Clean Architecture

Domain לא מכיר React, Express, Prisma, או ספק LLM.  
תלויות זורמות פנימה: Presentation → Application → Domain ← Infrastructure.

## GR-005 — אין קריאות LLM ישירות מקוד עסקי

כל AI עובר דרך AI Gateway בלבד (כרך 5).

## GR-006 — אין שאילתות DB מ־Controller

Controller → Service → Repository → Database בלבד.

## GR-007 — Validation לכל קלט

כל קלט חיצוני: Zod schema, DTO, sanitization. אין אמון ב־client.

## GR-008 — Security by Default

JWT + Refresh Rotation, CSRF, XSS, SQLi protection, Rate Limit, MFA/Passkeys, Secrets Management, Audit Logs, RBAC+ABAC — חובה לפי כרך 8.

## GR-009 — Accessibility Baseline

WCAG 2.2 AA מינימום; שאיפה ל־AAA במקומות מעשיים (כרך 4).

## GR-010 — PR Gate

אין Merge אם אחד מאלה נכשל: Type Check, Lint, Unit, Integration, Build, Security Scan, Dependency Scan, Secret Scan, Accessibility Scan, Performance Budget.

## GR-011 — ADR לחלטות ארכיטקטורה

כל החלטה ארכיטקטונית מהותית מתועדת כ־ADR לפני מימוש.

## GR-012 — Multi-tenant + Single-tenant

הארכיטקטורה תומכת בשני מודלים מהיום הראשון, בלי לשנות את ליבת הדומיין.

## GR-013 — i18n / Currency / Timezone

ריבוי שפות, מטבעות ואזורי זמן לכל מלון — דרישת ליבה, לא "Nice to have".

## GR-014 — Audit לכל פעולה עסקית

כל פעולה עסקית מתועדת ב־Audit עם מי, מה, מתי, איפה (tenant/hotel), ולמה (כאשר רלוונטי ל־AI).

## GR-015 — Human Approval ל־AI מסוכן

פעולות AI עם השפעה כספית / פרטיות / בטיחות דורשות אישור אנושי לפי מדיניות הסוכן (כרך 11).  
Autonomous Operations = Suggest → Approve → Act בלבד.

## GR-016 — Intelligence Layer First

מיצוב המוצר והסדר הטכני: קודם שכבת AI מעל מערכות קיימות (connectors + Twin), ורק אחר כך החלפת מודולים.  
אסור לתכנן "rip and replace" מלא כתנאי ל־MVP.

## GR-017 — Memory Separation

חובה להפריד: Short · Operational · Customer · Company Memory (כרך 5 / 5A).
