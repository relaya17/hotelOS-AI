import { CAPABILITIES } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function IntelligenceSection() {
  return (
    <RevealSection
      id="intelligence"
      className="section intelligence"
      aria-labelledby="intelligence-title"
    >
      <p className="eyebrow">אוטומציה · סוכנים · ראיית עתיד</p>
      <h2 id="intelligence-title">
        היכולות המלאות — אחרי שה־wedge מוכיח את עצמו
      </h2>
      <p className="section__lead">
        קודם תדריך, תקלות ותחזוקה חזויה. אחר כך land &amp; expand לכספים,
        אורח, צ׳אט רשת והכנסה נלווית. אותה פלטפורמה; בלי פרויקט החלפת PMS.
      </p>
      <ul className="cap-grid">
        {CAPABILITIES.map((cap) => (
          <li key={cap.id} className="cap">
            <h3 className="cap__title">{cap.title}</h3>
            <p className="cap__body">{cap.body}</p>
            <p className="cap__proof">{cap.proof}</p>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}
