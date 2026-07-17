# כרך 5 — AI Platform Standard

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** AI Platform Lead  
**חשיבות:** מסמך הליבה של היתרון התחרותי

---

## 5.1 עקרון על

AI הוא **פלטפורמה**, לא קריאות מודל מפוזרות בקוד.  
אסור לקרוא ל־LLM ישירות מלוגיקה עסקית (GR-005).

```
Business Use Case
       ↓ (port)
   AI Gateway
       ↓
 Prompt Engine → Memory → Tools → LLM Providers → Fallback
       ↓
  Audit + Cost + Eval + Guardrails
```

## 5.2 AI Gateway

תפקידים מחייבים:

- אימות זהות + הרשאות AI (AI Permissions)
- בחירת Agent / Workflow
- הזרת context מורשה בלבד (tenant/hotel/role)
- Rate limiting ייעודי ל־AI
- Routing לספקים + fallback
- איסוף טלמטריה: latency, tokens, cost, success/fail
- כתיבת AI Audit בכל בקשה/פעולה

## 5.3 Agent Framework

- כל Agent מוגדר כקונפיגורציה מגרסת־קוד + מדיניות (כרך 11)
- Tools הם חוזים טיפוסיים (Zod) עם הרשאות
- Orchestration: single-agent / multi-agent עם גבולות ברורים
- Timeout, retry, idempotency לפעולות בעלות side effects
- Deterministic tool execution; המודל לא "ממציא" APIs

## 5.4 Memory Fabric (הפרדה מחייבת)

ארכיטקטורה מלאה: [05a-ai-architecture.md](./05a-ai-architecture.md).

| סוג | שם | תוכן | TTL / מדיניות |
|-----|-----|------|----------------|
| Short Memory | `short` | שיחה נוכחית | קצר — מסתיים עם הסשן |
| Operational Memory | `operational` | מידע חי מהמלון (Twin / APIs) | רענון רציף; לא לאחסן כ־PII מיותר |
| Customer Memory | `customer` | העדפות אורח | Consent + retention (כרך 12) |
| Company Memory | `company` | נהלים / SOP | Versioned + Approval לשינויים מהותיים |

כללים:

- אסור לערבב Short לתוך Customer בלי consent מפורש + pipeline
- Operational נמשך ממקורות אמת — לא מ־LLM
- כל כתיבה: הרשאה + הצדקה + AI Audit

## 5.5 Knowledge Graph

- ישויות: Guest, Hotel, Room, Booking, Employee, Asset, Vendor, Policy…
- קשרים מפורשים (לא רק embeddings)
- שימוש ל־reasoning מבוקר + הסברים
- סנכרון מ־domain DBs — לא מקור אמת כספי/הזמנות

## 5.6 RAG

### מקורות ידע (Agent Knowledge Platform)

1. **Internal Knowledge** — נתוני מערכת לפי הרשאות  
2. **Trusted Knowledge** — מקורות חיצוניים מוגדרים מראש בלבד  
3. **Company Knowledge** — SOP, HR, חוזים, הדרכות  

### Continuous Learning Pipeline

```
Trusted Sources → Importer → Validation → Human Approval → Knowledge DB → Agents
```

כללים:

- אין גלישה חופשית בלתי מבוקרת כמקור אמת
- כל document versioned + checksum
- Approval למנהל לפני שינויים משמעותיים
- Citations חובה בתשובות מבוססות מסמכים

## 5.7 Prompt Engineering

- Prompts בגרסה (versioned templates) — לא מחרוזות פזורות ב־apps
- הפרדת System / Developer / User / Tool messages
- הזרת נתונים רגישים רק אחרי redaction policy
- בדיקות regression על prompts ב־AI Evaluation
- איסור prompt injection patterns: הפרדת נתונים מהוראות, sandbox לתוכן משתמש

## 5.8 AI Permissions

מטריצת הרשאה: `Agent × Role × Hotel × Tool × DataClass`

דוגמאות DataClass: `public`, `operational`, `pii`, `financial`, `security`, `hr_sensitive`

אין Agent שרואה הכול כברירת מחדל — Least Privilege.

## 5.9 AI Audit

לכל interaction נשמר לפחות:

- מי ביקש (user/service)
- איזה Agent
- קלט מאופסן (redacted)
- כלים שהופעלו + תוצאות מקוצרות
- החלטה / המלצה
- האם נדרש/התקבל Human Approval
- עלות (tokens/currency)
- מזהי correlation

שימור לפי כרך 12.

## 5.10 AI Explainability

- כל המלצה תפעולית/פיננסית חייבת הסבר קצר + גורמים עיקריים
- RAG: ציטוטים/מקורות
- Revenue/Maintenance: פיצ'רים משפיעים (ביקוש, עונה, sensor anomaly…)
- UI מציג "למה?" ולא רק "מה?"

## 5.11 AI Cost Optimization

- Caching סמנטי לתשובות חוזרות לא־רגישות
- Model routing: זול/מהיר למשימות פשוטות; חזק למורכבות
- הגבלת context window לפי צורך
- תקציב per-tenant / per-agent עם התראות
- מדידת ROI מול עלות ב־Executive views

## 5.12 AI Evaluation

חובה לפני הפעלת Agent בפרודקשן:

- Golden sets לתרחישים
- בדיקות בטיחות (jailbreak, leakage, harmful actions)
- Offline eval + canary online
- מדדים: task success, groundedness, latency, cost, approval rate, human override rate

## 5.13 AI Safety & Guardrails

שכבות:

1. Input guardrails (PII leak attempts, injection)
2. Policy engine (מה מותר ל־Agent)
3. Tool allowlist
4. Output filtering
5. Human Approval Flows לפעולות מסוכנות
6. Kill switch ברמת Agent / Tenant

## 5.14 Human Approval Flows & Autonomous Operations

פעולות שדורשות אישור אנושי כברירת מחדל (ניתן להחמיר per-tenant):

**סף כספי מחייב (החלטת PO, 2026-07-18):** כל העברה / זיכוי / שינוי מחיר מעל **₪2,000** *או* שינוי ADR מעל **5%** — דורש אישור אנושי. מתחת לסף — לפי מדיניות tenant (יכולה עדיין לדרוש אישור).

- שינוי מחירים גורף / פרסום תוצאות Simulator
- זיכויים מעל ₪2,000
- גישה/שינוי PII רגיש
- הודעות המוניות לאורחים
- שינויי Knowledge משמעותיים
- פעולות בטיחות / נעילת אזורים
- חתימות/חוזים
- הצעות Autonomous: מבצעים, הזמנת מלאי, שינויי תפעול גורפים

מצבי Approval: `one_person` | `dual_control` | `role_based`

זרימת Autonomous (חובה): **Suggest → Yes/No → Act** — אין Act בלי Approval במדיניות החוזה.

## 5.15 LLM Providers & Fallback

- הפשטה מאחורי Provider Port
- לפחות מסלול fallback מוגדר
- אסור לנעול את הליבה לספק יחיד בלי ADR
- מדיניות data residency לפי Enterprise contracts

## 5.16 Push AI

המערכת יזומה (לא רק תגובתית):

דוגמאות התראות:

- 🔴 תפוסה במלון ירדה ב־X%
- 🟠 מלאי עומד להיגמר
- 🟢 VIP מגיעים היום
- 🔴 חריגת תקציב

כל Push: עדיפות, קהל יעד, קישור לפעולה, הסבר, אפשרות snooze/ack — ו־audit.

## 5.17 אינטגרציה עם Apps

| App | AI capabilities |
|-----|-----------------|
| Guest | Receptionist, Concierge, service requests |
| Employee | Task prioritization, quality check, repair advice |
| Admin | Ops copilots, anomaly alerts |
| Executive | Natural language KPI Q&A, morning brief, approvals |

עדכונים לסוכנים: דרך Knowledge pipeline + versioned agent configs — נדחפים גם למובייל (sync מדיניות/יכולות).

## 5.18 Digital Twin · Simulator · Architecture

דרישות המוצר והתרשים המחייבים מפורטים בכרך **5A**:

- Digital Twin (Hotel → Floors → Rooms → Equipment → …)
- AI Simulator (what-if לפני החלטה)
- RAG + Vector DB + Company Knowledge
- Intelligence Layer מעל מערכות קיימות

## 5.19 קריטריוני אישור כרך 5

- [x] AI Gateway כנקודת כניסה יחידה מאושר
- [x] 4 סוגי Memory מאושרים
- [x] Knowledge pipeline עם Approval מאושר
- [x] Permissions + Audit + Guardrails מאושרים
- [x] Human Approval + Autonomous suggest/approve מאושר (סף ₪2,000 / 5% ADR)
- [x] כרך 5A מאושר יחד עם כרך זה

> אושר על ידי Product Owner ב־2026-07-18.
