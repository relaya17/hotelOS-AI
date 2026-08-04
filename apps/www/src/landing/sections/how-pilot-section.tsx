import { PILOT_STEPS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function HowPilotSection() {
  return (
    <RevealSection
      id="how-pilot"
      className="section how-pilot"
      aria-labelledby="how-pilot-title"
    >
      <p className="eyebrow">איך נראה הפיילוט</p>
      <h2 id="how-pilot-title">ארבעה שבועות. תוצאות מדידות.</h2>
      <p className="section__lead">
        בלי להחליף את ה־PMS. מתחילים מדומיין אחד־שניים ומודדים מול baseline —
        לא מול שקף מצגת.
      </p>
      <ol className="pilot-steps">
        {PILOT_STEPS.map((step) => (
          <li key={step.id} className="pilot-step">
            <p className="pilot-step__week">{step.week}</p>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>
      <p className="section__note">
        תבנית המדידה:{" "}
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
          Pilot ROI Scorecard
        </a>
        {" · "}
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/one-pager-hotel.md">
          One-pager לרשת
        </a>
        .
      </p>
    </RevealSection>
  );
}
