import { PARTNER_NAMES } from "../constants.js";
import { RevealSection } from "../reveal-section.js";

export function PartnersSection() {
  if (PARTNER_NAMES.length === 0) {
    return null;
  }

  return (
    <RevealSection
      id="partners"
      className="section partners"
      aria-labelledby="partners-title"
    >
      <p className="eyebrow">Design partners</p>
      <h2 id="partners-title">רשתות בפיילוט / שותפות</h2>
      <p className="section__lead">
        שמות מוצגים רק בהסכמה כתובה — דרך{" "}
        <code>VITE_PARTNER_NAMES</code>.
      </p>
      <ul className="partner-list">
        {PARTNER_NAMES.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </RevealSection>
  );
}
