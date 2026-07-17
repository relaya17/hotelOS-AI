# Engineering Standard — Changelog

## 1.0.3 — Docs + Kashrut Admin filled — 2026-07-18

- מולאו מסמכי Vol. 13 שהיו stubs: PRD, SRS, Architecture, ERD, Diagrams, OpenAPI inventory, Dev guide, Security guide, User/Admin manuals, Runbooks.
- Admin: טאב **כשרות** (`kashrut-page.tsx`) — הפעלה למלון + הערות ok/note/warn/block.

## 1.0.2 — Approved (completion pass) — 2026-07-18

Product Owner אישרה מחדש את כל המסמך ("הכל אמור להיות שלם מצידי") וסגרה את כל השאלות הפתוחות שנותרו. עדכון זה משלים את הסטנדרט ל־100% Approved, בלי חוסמי PO שנותרו:

- **כל הכרכים (0–13 + 5A + 11 AI Agents)**: Status עודכן מ־Draft ל־**✅ Approved**; כל קריטריוני האישור ("קריטריוני אישור כרך N") סומנו כמאושרים עם הערת PO.
- **סף אישור אנושי כספי ל־AI**: הוחלט ₪2,000 (העברות/זיכויים/שינוי מחיר) או 5% (שינוי ADR) — משוקע בכרך 5, כרך 11 וכל 19 קבצי ה־AI Agents.
- **ASVS target**: Level 2 ל־SaaS; Level 3 אופציונלי ל־Enterprise (כרך 8).
- **כיסוי בדיקות מינימלי**: 70% line coverage ל־packages עם לוגיקה; UI smoke + typecheck ל־apps (כרך 9).
- **PK strategy**: הוחלט UUID v4 (בשימוש כיום); UUID v7 אופציה עתידית (כרך 6).
- **RPO/RTO**: SaaS 24h/4h; Enterprise 1h/1h (כרך 6).
- **כרך 4 (Accessibility)**: נוספה רשימה סגורה של 7 מסכי עדיפות AAA.
- **כרך 12 (Compliance)**: נוספה טבלת retention מלאה (auth logs, audit, הקלטות, PII אורח, cookies, מסמכי עובד רגישים) + מדיניות hash/flag למידע פלילי.
- **כרך 13 (Documentation)**: תוקן נתיב שגוי `docs/deploy/` → `docs/deployment/`; נוצרו stub READMEs ל־`docs/prd`, `docs/srs`, `docs/architecture`, `docs/erd`, `docs/runbooks`, `docs/manuals` כדי שלא יישארו קישורים שבורים; נוצר `CONTRIBUTING.md` בשורש הריפו.
- **כרך 11 — כל 17 סוכני ה־AI ה"רזים"** (ceo, cfo, revenue, housekeeping, reception, hr, procurement, marketing, guest, concierge, restaurant, spa, security, maintenance, legal, analytics, sales) הורחבו לעומק מלא (~70–100 שורות) לפי תבנית `agent.cio`/`agent.kashrut`: מטרות ספציפיות לדומיין, כלים קונקרטיים, Org Comms, ספי הסלמה (₪2,000/5%), Explainability, Guardrails, Eval. תוקן סעיף "פעולות הדורשות אישור אנושי" הריק ב־`concierge-agent.md`. `cio-agent.md` ו־`kashrut-agent.md` סומנו Approved.
- **`docs/planning/`** — שלושת מסמכי התכנון (`facilities-ops-module.md`, `employee-hr-module.md`, `smart-integrations-and-hardening.md`) קיבלו סעיף "החלטות PO (2026-07-18)" שסוגר את כל השאלות הפתוחות (SLA, ספי אישור, VMS, briefing delivery, retention פלילי, ledger close, ועוד).
- **`docs/adr/README.md`** — נוצר אינדקס ADR (0001–0007).

## 1.0.0 — Approved — 2026-07-17

- Product Owner אישרה את כל הסטנדרט ("אני מאשרת הכל")
- סטטוס: Approved — מותר להתחיל קוד בכפוף ל־100% compliance

## 1.0.1-draft — 2026-07-17

- הוספת **כרך 5A — AI Architecture** (Gateway → Agents → RAG → Vector → Knowledge/Memory)
- Memory: Short / Operational / Customer / Company
- Digital Twin · AI Simulator · Autonomous Operations (Suggest → Approve → Act)
- היררכיית Multi-Tenant: Platform → Tenant → Chain → Hotel → Department → User
- מיצוב מחדש: **AI Intelligence Layer for Hotels** (לא "להחליף Oracle" ביום־1)
- תמחור מנחה + מקטעי שוק מורחבים
- Golden Rules: GR-016, GR-017

## 1.0.0-draft — 2026-07-17

- יצירת מבנה 13 כרכים + Golden Rules
- הגדרת חוק הזהב וחסימת קוד עד אישור
- קטלוג AI Agents ראשוני (17 סוכנים)
- יישור ל־Monorepo, Clean Architecture, AI Gateway, Multi/Single tenant
