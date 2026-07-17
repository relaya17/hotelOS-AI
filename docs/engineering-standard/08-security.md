# כרך 8 — Security Standard

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** Security Lead  
**בסיס:** OWASP ASVS · OWASP Top 10

---

## 8.1 מדיניות

אבטחה by default בכל שכבה.  
אין "נחבר אבטחה אחר כך". Secrets לא נכנסים ל־git לעולם.

## 8.2 OWASP

- יישור מול **OWASP ASVS** — **יעד הוחלט (PO, 2026-07-18): ASVS Level 2** לכל משטח SaaS multi-tenant עם PII/תשלומים. **Level 3** הוא שכבה אופציונלית נוספת ל־Enterprise single-tenant לפי חוזה (לא חוסם ל־SaaS).
- כיסוי מפורש ל־**OWASP Top 10** בבדיקות וב־Review

## 8.3 Authentication

חובה:

- JWT Access tokens קצרי חיים
- Refresh Token Rotation + reuse detection
- MFA
- Passkeys (WebAuthn) — יעד v1 למשתמשי Admin/Executive לפחות
- Session Management מאובטח (idle timeout, absolute timeout)
- Brute force protection + lockout/backoff
- CSRF protection למשטחי cookie session אם בשימוש

## 8.4 Authorization

- **RBAC** לתפקידים סטנדרטיים
- **ABAC** לתנאים (hotel, region, resource owner, time, risk)
- בדיקה ב־Application layer לכל use case
- AI Permissions נפרדים אך משולבים (כרך 5)

## 8.5 Encryption

- TLS בכל התעבורה החיצונית
- Encryption at rest ל־DBs וגיבויים
- מפתחות ב־KMS / HSM לפי סביבה
- שדות רגישים במיוחד: field-level encryption לפי הצורך

## 8.6 Secrets Management

- Secret Manager בלבד
- Rotation מדיניות
- גישה least privilege ל־identities
- Secret Scan ב־CI (חוסם)

## 8.7 הגנות אפליקטיביות

- XSS Protection (CSP, encoding)
- SQL Injection Protection (parameterized / ORM בטוח — בלי SQL דינמי לא מאומת)
- Input validation (Zod)
- Rate limiting (כרך 7)
- SSRF הגנה על webhooks/importers
- Dependency scanning

## 8.8 Audit Logs & SIEM

- Audit לכל פעולה עסקית ושינוי הרשאות
- לוגים בלתי ניתנים לשינוי במידת האפשר (`audit_db`)
- SIEM Integration (Enterprise): ייצוא סטנדרטי (למשל CEF/JSON)
- התראות על דפוסים חשודים

## 8.9 Data Retention & Privacy Controls

- מדיניות שמירה/מחיקה (כרך 12)
- Right to erasure workflows תואמי GDPR עם מגבלות חוקיות (חשבוניות וכו')
- הפרדת סביבות (prod/stage/dev) — אין נתוני אמת ב־dev בלי anonymization

## 8.10 Incident Response

חובה מסמך IR:

1. Detect  
2. Contain  
3. Eradicate  
4. Recover  
5. Postmortem  

זמני תגובה לפי חומרה; תקשורת ללקוחות Enterprise לפי חוזה.

## 8.11 Secure SDLC

- Threat modeling לפיצ'רים רגישים (תשלומים, מפתחות דיגיטליים, AI tools)
- Security tests ב־QA (כרך 9)
- אין Merge בלי Security + Secret + Dependency scans

## 8.12 קריטריוני אישור כרך 8

- [x] ASVS target level מאושר (Level 2 SaaS; Level 3 אופציונלי Enterprise)
- [x] MFA + Passkeys policy מאושרת
- [x] RBAC+ABAC מאושר
- [x] IR process מאושר

> אושר על ידי Product Owner ב־2026-07-18.
