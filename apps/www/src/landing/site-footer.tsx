import { LegalFooter } from "@hotelos/features";
import { APP_URLS } from "@hotelos/web-client";
import { PILOT_MAIL } from "./constants.js";

export function SiteFooter() {
  return (
    <div className="foot">
      <div className="foot__brand">
        <p>
          <strong>HotelOS AI</strong>
        </p>
        <p className="foot__tag">Intelligence Layer for Hotels</p>
      </div>
      <div className="foot__grid" aria-label="ניווט תחתון">
        <div className="foot__col">
          <h3>מוצר</h3>
          <a href="#platform">הפלטפורמה</a>
          <a href="#outcomes">תוצאות</a>
          <a href="#profit">רווחיות</a>
          <a href="#packages">חבילות</a>
          <a href="#demo">דמו</a>
        </div>
        <div className="foot__col">
          <h3>אמון</h3>
          <a href="#trust">בקרות אבטחה</a>
          <a href="#status">סטטוס API</a>
          <a href={APP_URLS.legal("security")}>מדיניות אבטחה</a>
          <a href={APP_URLS.legal("subprocessors")}>ספקי עיבוד</a>
          <a href={APP_URLS.legal("dpa")}>תבנית DPA</a>
          <a href={APP_URLS.legal("accessibility")}>הצהרת נגישות</a>
          <a href={APP_URLS.legal("privacy")}>פרטיות</a>
          <a href={APP_URLS.legal("cookies")}>עוגיות</a>
          <a href="/.well-known/security.txt">security.txt</a>
        </div>
        <div className="foot__col">
          <h3>התחלה</h3>
          <a href={PILOT_MAIL}>פיילוט</a>
          <a href={APP_URLS.legal("terms")}>תנאי שימוש</a>
          <a href={APP_URLS.legal("meetings")}>מדיניות פגישות</a>
          <a href="#faq">שאלות נפוצות</a>
        </div>
      </div>
      <LegalFooter legalUrl={(doc) => APP_URLS.legal(doc)} />
    </div>
  );
}
