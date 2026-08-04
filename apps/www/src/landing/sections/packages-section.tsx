import { PACKAGES } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function PackagesSection() {
  return (
    <RevealSection
      id="packages"
      className="section packages"
      aria-labelledby="packages-title"
    >
      <p className="eyebrow">איך קונים</p>
      <h2 id="packages-title">Pilot · Network · Enterprise</h2>
      <p className="section__lead">
        מחירון רשימה אחיד ב־USD לכל העולם (כולל ישראל). סגירה בשיחה —
        בלי ROI מומצא ובלי תעודות שלא קיימות.
      </p>
      <ul className="package-grid">
        {PACKAGES.map((tier) => (
          <li key={tier.id} className="package-tier">
            <h3>{tier.name}</h3>
            <p className="package-tier__audience">{tier.audience}</p>
            <ul>
              {tier.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}
