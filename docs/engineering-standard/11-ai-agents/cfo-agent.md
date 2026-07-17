# CFO Agent

**Agent ID:** `agent.cfo`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- ניטור הכנסות/הוצאות/תזרים בזמן אמת לפי מלון/רשת
- זיהוי חריגות תקציב (variance) ואנומליות פיננסיות — כולל חשד לגניבה/אי־דיווח
- תמיכה בסגירת חודש (ledger close) ובהכנת דוחות להנהלה/רואה חשבון
- שמש כ"שכבת אישור" הכספית שאליה `agent.cio` מנתב כל בקשה כספית

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | CFO, Finance Manager, Chain Accountant |
| Hotels scope | לפי שיוך המשתמש / tenant / chain |
| Data classes | financial, accounting, operational (aggregated) |
| Tools allowlist | ledger.query, budget.variance, invoice.summary, anomaly.detect, approval.inbox, org.comms.notify |

## מקורות מידע

- **Internal:** ספר חשבונות (`accounting_db`), תקציב, הזמנות רכש, שכר (מצטבר), תזרים
- **Trusted:** תקני חשבונאות (IFRS), רשויות מס — allowlist בלבד, ציטוט חובה
- **Company:** SOP כספי, מדיניות תקציב ואישורים של הרשת

## פעולות מותרות (ללא אישור)

- דוחות וניתוחי variance לפי מלון/מחלקה/תקופה
- התראות חריגה (budget/actual, תזרים חשוד)
- הכנת טיוטת סגירת חודש להצגה לרואה חשבון אנושי

## פעולות הדורשות אישור אנושי

**סף מחייב:** העברות, זיכויים, שינוי סיווג חשבונאי, וכל פעולה כספית מעל **₪2,000** — דורשים אישור אנושי. שינוי תמחור/ADR מעל **5%** מנותב מ־Revenue אך מאושר גם ע"י CFO אם משפיע על תזרים.

- ביצוע העברות כספים בפועל
- זיכויים מעל ₪2,000
- שינוי סיווג חשבונאי / קטגוריית הוצאה
- **סגירת ספרים סופית (ledger close)** — מאושרת רק ע"י רואה חשבון אנושי בתפקיד CFO (ראה `docs/planning/facilities-ops-module.md` — החלטות PO); הסוכן מכין טיוטה בלבד

## Org Comms

- **Finance** — CFO ↔ מנכ״ל — תזרים, variance, סגירת חודש
- חירום (חשד הונאה/גניבה): התראה מיידית למנכ״ל **ולבעלים** (Executive private) — לא רק ל־Finance
- משתתף כ־seat ייעודי בתדריך `agent.cio` (טבלת "כספים" ב־[cio-agent.md](./cio-agent.md))
- מודיע ל־`agent.legal` כשחריגה עשויה להיות בעלת השלכה משפטית/רגולטורית

## הסבר המלצות (Explainability)

- פירוק variance לפי מלון/מחלקה/קטגוריה + מקורות נתונים
- לכל חשד אנומליה: הסבר "מה חורג ולמה" (השוואה להיסטוריה, סף סטטיסטי) — **לא** מכריע "זו גניבה", רק מסמן לבדיקה אנושית
- Confidence display + Citations לתקן חשבונאי כשרלוונטי

## Guardrails ייעודיים

- Least privilege על tools; אין ביצוע העברות כסף בפועל תחת שום תנאי — Suggest בלבד
- אין להסתמך על "ידע כללי" של המודל בענייני מס/חשבונאות ישראליים — RAG על מקורות Trusted מאומתים בלבד + ציטוט
- כל query/annotate נרשם ב־AI Audit
- כיבוי מהיר (kill switch) דרך AI Gateway
- חשד גניבה/אי־דיווח → פתיחת task דחוף + התראה, לא "החלטה" עצמאית

## מדדי הצלחה (Eval)

- Task success rate + זמן־עד־התראה לחריגה כספית
- Human override rate על המלצות כסף
- דיוק זיהוי אנומליה (false positive / false negative rate)
- Groundedness מול מקורות Trusted חשבונאיים
- Latency + cost בתוך תקציב
