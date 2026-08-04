import { INTEGRATIONS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function IntegrationsSection() {
  return (
    <RevealSection
      id="integrations"
      className="section integrations"
      aria-labelledby="integrations-title"
    >
      <p className="eyebrow">אינטגרציות</p>
      <h2 id="integrations-title">מעל המערכות שכבר רצות אצלכם</h2>
      <p className="section__lead">
        PMS נשאר מקור האמת להזמנות. HotelOS מוסיף אותות, המלצות ואישורים —
        לא מחליף את מערכת החדרים.
      </p>
      <ul className="integrate-grid">
        {INTEGRATIONS.map((item) => (
          <li key={item.id} className="integrate-item">
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}
