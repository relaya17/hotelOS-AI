import { APP_URLS } from "@hotelos/web-client";
import { TRUST_CONTROLS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function TrustSection() {
  return (
    <RevealSection
      id="trust"
      className="section trust"
      aria-labelledby="trust-title"
    >
      <p className="eyebrow">אבטחה ואמון</p>
      <h2 id="trust-title">
        אמינות שאתם יכולים לבדוק — בלי תעודות שקריות
      </h2>
      <p className="section__lead">
        תקבלו HITL, הרשאות, הגבלת קצב ו־AI Gateway — לא באנר SOC2 מזויף. אין
        לנו attestation עדיין; יש בקרות חיות ונתיב certification מוכן. זה מה
        שעומד מאחורי פיילוט אצלכם.
      </p>
      <ul className="trust-grid">
        {TRUST_CONTROLS.map((control) => (
          <li key={control.id} className="trust-control">
            <h3>{control.title}</h3>
            <p>{control.body}</p>
          </li>
        ))}
      </ul>
      <p className="trust-note">
        הפירוט המלא, כולל מדיניות אימות ונתונים רגישים, במסמך{" "}
        <a href={APP_URLS.legal("security")}>מדיניות האבטחה</a>
        {" · "}
        <a href={APP_URLS.legal("subprocessors")}>ספקי עיבוד</a>
        {" · "}
        <a href={APP_URLS.legal("dpa")}>תבנית DPA</a>
        {" · "}
        <a href={APP_URLS.legal("accessibility")}>הצהרת נגישות</a>
        {" · "}
        <a href="/.well-known/security.txt">security.txt</a>
        {" · "}
        <a href="#status">סטטוס API</a>.
      </p>
    </RevealSection>
  );
}
