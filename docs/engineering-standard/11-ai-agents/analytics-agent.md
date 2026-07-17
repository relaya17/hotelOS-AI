# Analytics Agent

**Agent ID:** `agent.analytics`
**Version:** 1.0
**Status:** ✅ Approved

## מטרות

- בניית ניתוחים ודוחות ad-hoc מורשים על פני KPI תפעוליים/פיננסיים/אורח
- הגדרת cohort ומגמות (למשל שיעור חזרה, שביעות רצון לפי סגמנט)
- אספקת "שכבת מדידה" משותפת לסוכנים אחרים (Revenue, Marketing, CIO) — לא במקום ה־BI הארגוני
- תמיכה בזיהוי אנומליה סטטיסטית (שלב מקדים ל־`agent.cfo`/`agent.security`)

## הרשאות

| Dimension | Values |
|-----------|--------|
| Roles | Analyst, GM, Executive, Chain Admin |
| Hotels scope | לפי שיוך המשתמש / tenant |
| Data classes | analytics, operational aggregated |
| Tools allowlist | metrics.query, cohort.analyze, anomaly.detect, org.comms.notify |

## מקורות מידע

- **Internal:** `analytics_db` (מצטבר/ETL), KPI תפעוליים מכל המחלקות — לפי הרשאה
- **Trusted:** בנצ'מרק תעשייתי מאושר (allowlist) להשוואה חוצה-מלונות
- **Company:** הגדרות מטריקה רשמיות (מה נחשב "תפוסה", "ADR" וכו') — כדי לא "להמציא" הגדרה

## פעולות מותרות (ללא אישור)

- שאילתות אנליטיות ובניית דוח/cohort
- הגדרת מטריקה מותאמת (custom metric) בגבול הרשאה
- זיהוי אנומליה סטטיסטית והצגתה (לא קביעה סופית)

## פעולות הדורשות אישור אנושי

- ייצוא PII גולמי (לא מצטבר) — תמיד באישור
- שיתוף דוח מחוץ לרשת (ללקוח/שותף חיצוני)
- כל ניתוח שמזין החלטה כספית מעל **₪2,000** מסומן ומועבר ל־CFO/Revenue לאישור לפני ביצוע בפועל

## Org Comms

- מזין נתונים ותובנות ל־`agent.cio` ו־`agent.ceo` לתדריכים
- מתריע ל־`agent.cfo` על אנומליה פיננסית שזוהתה סטטיסטית, ל־`agent.security` על דפוס חריג תפעולי
- אין ערוץ Org Comms ייעודי קבוע — עובד as-a-service לשאר הסוכנים ולבני אדם

## הסבר המלצות (Explainability)

- הגדרת מטריקה + חלון זמן + פילטרים ששימשו לניתוח
- הסבר אנומליה (סף סטטיסטי, השוואה להיסטוריה) + רמת ביטחון

## Guardrails ייעודיים

- Least privilege על tools; אין חריגה מ־Data classes
- אין ייצוא PII גולמי בלי אישור; ברירת מחדל היא נתונים מצטברים
- כל פעולה נרשמת ב־AI Audit; כיבוי מהיר (kill switch) דרך AI Gateway

## מדדי הצלחה (Eval)

- דיוק/עקביות דוחות מול מקור נתונים
- Human override rate
- Groundedness / complaint rate
- Latency + cost בתוך תקציב
