# כרך 12 — Compliance

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Compliance / Legal

---

## 12.1 מטרה

HotelOS AI מטפל ב־PII, תשלומים, נתוני עובדים והחלטות AI — ולכן ציות הוא דרישת ליבה מהיום הראשון.

## 12.2 GDPR

חובה לתמוך ב:

- Lawful basis / Consent management
- Data Subject Rights (access, rectification, erasure עם מגבלות חוקיות, portability)
- Data Minimization
- Privacy by Design
- Records of Processing
- Breach notification processes

## 12.3 חוקי פרטיות מקומיים

- התאמה לחוקי ישראל (כולל הנחיות רלוונטיות)
- מודולריות להוספת jurisdictions (EU, UK, US states…)
- **CCPA** אם פועלים בארה״ב — דרישות נפרדות במודול Legal

## 12.4 Cookie Consent

- Banner + העדפות מפורטות
- Cookie Policy
- אין cookies לא־הכרחיים לפני הסכמה
- קישור קבוע ל־Cookie Settings ב־Footer

## 12.5 מסמכים משפטיים חובה

| מסמך | משטח |
|------|--------|
| Terms of Service | Public + Apps |
| Privacy Policy | Public + Apps |
| Cookie Policy | Public |
| Accessibility Statement | Public |
| AI Transparency | Public + Admin |
| Data Processing Agreements (DPA) | Enterprise |

## 12.6 AI Transparency

חובה ליידע משתמשים מתי הם מתקשרים עם AI, מה המגבלות, וכיצד לערער/לבקש אדם.  
פירוט טכני: כרך 5 (Audit, Explainability, Approvals).

## 12.7 Data Retention

- טבלת retention לכל סוג נתון (booking, audit, AI memory, logs)
- מחיקה אוטומטית/מתוזמנת + חריגים חוקיים (חשבונאות)
- מדיניות נפרדת ל־AI Memory של אורחים (consent-bound)

### 12.7.1 טבלת Retention — ברירת מחדל (הוחלט, PO 2026-07-18)

| סוג נתון | תקופת שימור | הערות |
|----------|--------------|--------|
| Auth logs (login, token rotation, MFA) | **1 שנה** | ביקורת אבטחה |
| Audit trail (`audit_db`) | **7 שנים** | דרישות חשבונאיות/רגולטוריות; append-only/WORM |
| הקלטות (בריפינג/Meet) | **90 יום** | אלא אם `legal hold` — אז שימור עד סיום ההליך |
| PII של אורחים (guest_db, customer memory) | **3 שנים** מסוף השהייה האחרונה | או לפי חוזה Enterprise אם מגדיר תקופה אחרת |
| הסכמת Cookies | **2 שנים** | לפי תוקף הסכמה סטנדרטי; מתבקש רענון בתום התקופה |
| מסמכי עובד רגישים (תעודת יושר וכו׳) | **2 שנים** לאחר סיום העסקה (hash/flag בלבד — ראו כרך 12 §12.9.1) | מסמך מלא מנוהל מחוץ למערכת |

חריגים חוקיים (חשבוניות, מס) גוברים על מחיקה אוטומטית. מחיקה בפועל דרך job מתוזמן + audit על כל מחיקה.

## 12.8 Audit Readiness

- יכולת להפיק דוחות ציות
- שמירת ראיות ל־approvals, consents, access reviews
- הפרדת תפקידים לגישה לנתונים רגישים

## 12.9 קריטריוני אישור כרך 12

- [x] GDPR baseline מאושר
- [x] רשימת מסמכים משפטיים מאושרת
- [x] AI Transparency מאושר
- [x] Retention table אושרה (§12.7.1) — אין עוד blocker לפני P2

### 12.9.1 מידע פלילי / תעודת יושר — מדיניות (הוחלט, PO 2026-07-18)

בהתאם למסמך התכנון `docs/planning/employee-hr-module.md`: המערכת שומרת **hash/flag בלבד** (סטטוס אושר/נדחה/פג תוקף + hash של הקובץ לצורך אימות שלמות) למשך **2 שנים** לאחר סיום העסקה. **המסמך המלא הסרוק אינו נשמר במערכת** — מאוחסן off-platform (תיק פיזי/מערכת HR ייעודית) בכפוף לייעוץ משפטי. אין אימות אוטומטי מול משטרה/רשות.

> אושר על ידי Product Owner ב־2026-07-18.
