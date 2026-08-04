import { RevealSection } from "../reveal-section.js";

export function FaqSection() {
  return (
    <RevealSection
      id="faq"
      className="section faq"
      aria-labelledby="faq-title"
    >
      <p className="eyebrow">שאלות נפוצות</p>
      <h2 id="faq-title">שאלות שאתם שואלים לפני פיילוט</h2>
      <div className="faq__list">
        <details className="faq__item" open>
          <summary>האם HotelOS מחליף את ה־PMS?</summary>
          <p>
            לא. אנחנו שכבת אינטליגנציה מעל Opera / Protel / Fidelio / Clock
            ועוד —{" "}
            <a href="#taglines">
              We don&apos;t replace your PMS. We make it smarter.
            </a>
          </p>
        </details>
        <details className="faq__item">
          <summary>חייבים לקחת את כל המערכת?</summary>
          <p>
            לא. מתחילים ב־wedge (תדריך + תקלות + HITL), מודדים, ואז מרחיבים
            דומיין־דומיין. ה־PMS נשאר; מתממשקים מעליו.{" "}
            <a href="#profit">רווחיות ומודולריות</a>.
          </p>
        </details>
        <details className="faq__item">
          <summary>מה הסוכנים באמת עושים?</summary>
          <p>
            תדריכים, תחזיות, אנומליות, upsell, תחזוקה חזויה, מזכירת ישיבות,
            והמלצות כספים — דרך AI Gateway, עם אישור אנושי לפעולות רגישות.{" "}
            <a href="#intelligence">למפת היכולות</a>.
          </p>
        </details>
        <details className="faq__item">
          <summary>איך עובד הצ׳אט בין שפות?</summary>
          <p>
            כותבים בשפה שלכם; הצד השני מקבל בשפתו. על אותה שיחה אפשר להריץ
            אוטומציות (משימה, תזכורת, העברה) —{" "}
            <a href="#chat">ראו הדגמה</a>.
          </p>
        </details>
        <details className="faq__item">
          <summary>מה מקבלים בפיילוט?</summary>
          <p>
            דומיין אחד־שניים עם מדידת תוצאות: תדריכים, תקלות, ניקיון חדרים,
            upsell — לפי{" "}
            <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
              Pilot ROI Scorecard
            </a>
            .
          </p>
        </details>
      </div>
    </RevealSection>
  );
}
