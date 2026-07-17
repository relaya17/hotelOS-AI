# כרך 12 — Compliance

**Version:** 1.0 (Draft)  
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

## 12.8 Audit Readiness

- יכולת להפיק דוחות ציות
- שמירת ראיות ל־approvals, consents, access reviews
- הפרדת תפקידים לגישה לנתונים רגישים

## 12.9 קריטריוני אישור כרך 12

- [ ] GDPR baseline מאושר
- [ ] רשימת מסמכים משפטיים מאושרת
- [ ] AI Transparency מאושר
- [ ] Retention table תיוצר לפני P2 (blockers מתועדים)
