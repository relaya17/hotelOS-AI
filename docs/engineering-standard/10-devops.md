# כרך 10 — DevOps Standard

**Version:** 1.0  
**Status:** ✅ Approved (PO, 2026-07-18)  
**Owner:** DevOps / Platform Lead

---

## 10.1 עקרונות

- Infrastructure as Code
- סביבות זהות ככל האפשר
- Deploy בטוח עם Rollback מהיר
- Observability מהיום הראשון

## 10.2 Containers & Orchestration

- **Docker** לכל שירות הריצה
- **Kubernetes** כאשר נדרש (סקייל/Enterprise); לא חובה ל־MVP אם יש הצדקת ADR לחלופה מנוהלת
- Images מינימליים, non-root, scan פגיעויות

## 10.3 CI/CD

כל PR חייב לעבור (חוסם):

1. Type Check  
2. Lint  
3. Unit Tests  
4. Integration Tests  
5. Build  
6. Security Scan  
7. Dependency Scan  
8. Secret Scan  
9. Accessibility Scan (UI)  
10. Performance Budget (UI)

Deploy ל־prod רק מ־main/protected branch אחרי gates.

## 10.4 Feature Flags

- כל פיצ'ר מסוכן מאחורי Flag
- הפרדת deploy מ־release
- Flags מתועדים + בעלים + תאריך תפוגה (אין flags נצחיים בלי סיבה)

## 10.5 אסטרטגיות פריסה

| אסטרטגיה | שימוש |
|-----------|--------|
| Blue/Green | שירותי ליבה |
| Canary | שינויי AI / חיוב / הזמנות |
| Rollback | חובה מתורגלת < יעד זמן ב־ADR |

## 10.6 Observability

חובה:

- **OpenTelemetry** (traces/metrics/logs correlation)
- **Prometheus** metrics
- **Grafana** dashboards
- **Sentry** (או מקביל) לשגיאות אפליקטיביות

מדדים מינימליים: latency, error rate, saturation, booking success, payment success, AI cost/latency, queue lag.

## 10.7 Monitoring & Alerting

- Alert רק על מה שדורש פעולה
- On-call runbooks (כרך 13)
- הפרדת severity: P1–P4
- AI-specific alerts: spike בעלות, ירידה ב־groundedness, כשל אישורים

## 10.8 Environments

`dev` · `staging` · `prod` (+ `enterprise-dedicated` לפי לקוח)

אין נתוני ייצור ב־dev. Staging עם נתונים מסונתזים/אנונימיים.

## 10.9 קריטריוני אישור כרך 10

- [x] PR Gate מלא מאושר
- [x] Feature flags + canary/blue-green מאושרים
- [x] Observability stack מאושר

> אושר על ידי Product Owner ב־2026-07-18.
