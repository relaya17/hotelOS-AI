# כרך 5A — AI Architecture

**Version:** 1.0 (Draft)  
**Owner:** AI Platform Lead + Chief Architect  
**קשור:** [05-ai-platform.md](./05-ai-platform.md) · [11-ai-agents/](./11-ai-agents/README.md)

---

## 5A.1 מטרה

להגדיר את הארכיטקטורה המחייבת של שכבת ה־AI — איך Gateway, Agents, RAG, Vector DB, Memory ו־Digital Twin מתחברים — בלי קריאות מודל מפוזרות בקוד עסקי.

## 5A.2 תרשים על (מחייב)

```
                         AI Gateway
                              |
        ---------------------------------------------
        |            |            |                |
     Revenue        HR         Guest         Maintenance
     Agent        Agent        Agent            Agent
        |            |            |                |
        ---------------------------------------------
                              |
                         RAG Layer
                              |
                      Vector Database
                              |
              --------------------------------
              |                              |
       Company Knowledge              Memory Fabric
         (versioned docs)         (4 memory types)
```

הערות:

- הסוכנים בתרשים הם **דוגמאות**; הקטלוג המלא בכרך 11.
- כל בקשה נכנסת **רק** דרך AI Gateway.
- RAG + Vector DB + Memory הם תשתית משותפת; כל Agent מקבל slice לפי הרשאות.

## 5A.3 AI Gateway — אחריות

| אחריות | פירוט |
|--------|--------|
| Identity | משתמש / שירות / Agent identity |
| Tenancy scope | Platform → Tenant → Chain → Hotel → Department |
| Route | בחירת Agent / multi-agent workflow |
| Policy | AI Permissions + Guardrails |
| Context pack | בניית context מורשה בלבד |
| Providers | LLM routing + fallback |
| Side effects | Tool execution דרך allowlist |
| Observability | cost, latency, audit, eval hooks |

## 5A.4 שכבת Agents

כל Agent:

- רשום ב־Agent Registry (גרסה, tools, policies)
- מקבל רק Data classes מותרים
- כותב הסבר (Explainability) + Audit
- פעולות מסוכנות → Human Approval (כרך 5 / 11)

דוגמאות נתיבים:

| בקשה | Agent ראשי |
|------|------------|
| "העלה מחיר לסופ״ש באילת" | Revenue |
| "מה מדיניות חופשת מחלה?" | HR |
| "אני רוצה חדר עם נוף לים" | Guest / Reception |
| "המזגן ב־412 מרעיש" | Maintenance |

## 5A.5 RAG Layer

```
Query → Retrieve (Vector + Graph + Filters)
      → Rank / Ground
      → Generate (LLM)
      → Cite + Guardrail check
      → Response / Tool plan
```

מקורות ל־Retrieve:

1. Company Knowledge (נהלים, SOP) — versioned  
2. Trusted Knowledge — מקורות חיצוניים מאושרים  
3. Internal operational projections — לפי הרשאה (לא לשאוב DB גולמי בלי policy)

## 5A.6 Vector Database

- אינדקסים מופרדים לוגית לפי `tenant_id` (ו־hotel כשצריך)
- מטא־דאטה חובה על כל chunk: `tenantId`, `hotelId?`, `sourceId`, `version`, `dataClass`, `acl`
- שאילתה תמיד מסוננת ב־ACL לפני ה־top-k
- Embeddings אינם מקור אמת עסקי — רק retrieval

## 5A.7 Memory Fabric (הפרדה מחייבת)

| סוג | שם באנגלית | תוכן | דוגמה |
|-----|------------|------|--------|
| Short Memory | `short` | שיחה נוכחית | הודעות הצ'אט האחרונות |
| Operational Memory | `operational` | מידע חי מהמלון | תפוסה, חדרים dirty, תקלות פתוחות |
| Customer Memory | `customer` | העדפות אורח (בהסכמה) | כריות, קומה, אלרגיות |
| Company Memory | `company` | נהלים וידע ארגוני | SOP קבלה, מדיניות ביטולים |

כללים:

- Short ≠ Customer — לא לערבב שיחה זמנית בפרופיל קבוע בלי consent + pipeline
- Operational נמשך מ־Digital Twin / domain APIs — לא מ־hallucination
- Company נטען מ־Knowledge pipeline עם Approval לשינויים מהותיים
- כתיבה לכל סוג זיכרון: permission + audit + retention (כרך 12)

## 5A.8 Company Knowledge

```
Sources → Importer → Validation → Approval → Knowledge Store
                                              ├─ Vector index
                                              └─ Document versions
```

אין "למידה חופשית מהאינטרנט" כמקור אמת.

## 5A.9 Digital Twin של המלון

מודל וירטואלי חי של הנכס — ה־AI "מבין את כל המלון" דרכו:

```
Hotel Twin
├── Floors
├── Rooms (status, type, features, housekeeping state)
├── Equipment / Assets (HVAC, elevators, boilers, sensors)
├── Employees (on shift, skills, location if permitted)
├── Guests (in-house, VIP, preferences — ACL)
├── Revenue (pace, ADR, pickup — aggregated by role)
└── Inventory (par levels, critical SKUs)
```

כללים:

- Twin הוא **projection** — מקור האמת נשאר ב־domain DBs
- עדכון בזמן אמת / near-real-time דרך events
- כל קריאת Twin ב־AI מסוננת לפי תפקיד ומלון
- בסיס ל־Simulator ול־Autonomous Operations

## 5A.10 AI Simulator

לפני החלטה תפעולית/מחירית:

> "אם אני מעלה מחיר ב־15%, מה יקרה?"

המערכת מריצה סימולציה על Twin + מודלים (ביקוש, המרה, cannibalization) ומחזירה:

- תרחיש בסיס vs תרחיש מוצע
- טווחי ביטחון / הנחות
- סיכונים (תפוסה↓, ADR↑, ביטולים)
- **לא** מבצעת שינוי — רק מדמה, עד Approval

Simulator הוא tool מורשה ל־Revenue / Executive agents בלבד (או roles מוגדרים).

## 5A.11 Autonomous Operations

שלב בשלות (לא יום־1 מלא):

1. **Observe** — מבין מצב (Twin + KPIs)  
2. **Suggest** — מציע פעולה  
3. **Approve** — מנהל: כן / לא  
4. **Act** — ביצוע דרך tools  
5. **Learn (controlled)** — משוב ל־eval, לא שינוי עצמי של המודל  

דוגמאות הצעות:

| הצעה | דורש אישור |
|------------------|
| להפעיל מבצע סוף שבוע? | כן |
| להזמין מלאי קפה? | כן (מעל סף / תמיד לפי מדיניות tenant) |
| לשבץ חדר לניקוי דחוף | לפי מדיניות (ייתכן אוטומטי בגבול) |

עקרון: **AI לא שולט בשקט** על כסף, מלאי גדול, או בטיחות בלי Human Approval.

## 5A.12 Multi-Tenant בנתיב ה־AI

כל קריאת Gateway נושאת הקשר היררכי (ראה גם כרך 1 / 6):

```
Platform
  └── Tenant
        └── Hotel Chain
              └── Hotel
                    └── Department
                          └── User
```

דוגמה: פתאל — Tenant אחד → מדינות/אזורים → ~150 מלונות → אלפי משתמשים.  
Agent לעולם לא חוצה tenant; חציית מלונות רק עם הרשאה מפורשת.

## 5A.13 מיצוב ארכיטקטוני: Intelligence Layer

בשלב הראשון ה־AI Layer יכול לשבת **מעל מערכות קיימות** (PMS/CRM וכו') דרך מחברים:

```
Legacy PMS / CRM / ERP ──connectors──► Digital Twin / Events
                                              │
                                         AI Gateway
```

כך HotelOS מתחיל כ־**AI Intelligence Layer for Hotels**, ואחר כך מוסיפים מודולי ליבה שמחליפים מערכות — בלי לשבור את ארכיטקטורת ה־AI.

## 5A.14 קריטריוני אישור כרך 5A

- [ ] תרשים Gateway → Agents → RAG → Vector → Knowledge/Memory מאושר
- [ ] 4 סוגי Memory מאושרים
- [ ] Digital Twin + Simulator + Autonomous (עם Approval) מאושרים כחלק מהארכיטקטורה
- [ ] Tenancy hierarchy מחייבת בנתיב AI מאושרת
