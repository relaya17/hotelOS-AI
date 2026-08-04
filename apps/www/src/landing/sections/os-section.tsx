import { ORG_NODES } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function OsSection() {
  return (
    <RevealSection id="os" className="section os" aria-labelledby="os-title">
      <p className="eyebrow">המערכת</p>
      <h2 id="os-title">HotelOS AI = מערכת ההפעלה לרשת שלכם</h2>
      <p className="section__lead">
        מהמנכ״ל עד האורח — אותה שכבת בינה. ארבע אפליקציות, תפקידים ברורים,
        וסוכנים תחת Gateway אחד. לא מחליפה את ה־PMS שלכם; מחברת את הארגון
        מעליו.
      </p>
      <div className="os-map" aria-hidden="false">
        <div className="os-map__exec">
          <span className="os-node os-node--ceo">{ORG_NODES.executives[0]}</span>
          <div className="os-map__cfo-coo">
            <span className="os-node">{ORG_NODES.executives[1]}</span>
            <span className="os-node">{ORG_NODES.executives[2]}</span>
          </div>
        </div>
        <div className="os-map__spine" aria-hidden="true" />
        <p className="os-map__core">
          <span>HotelOS AI</span>
          <small>Agents · Automations · Foresight</small>
        </p>
        <div className="os-map__spine" aria-hidden="true" />
        <ul className="os-map__depts">
          {ORG_NODES.departments.map((dept) => (
            <li key={dept} className="os-node os-node--dept">
              {dept}
            </li>
          ))}
        </ul>
        <div className="os-map__spine" aria-hidden="true" />
        <p className="os-node os-node--guest">Guest</p>
      </div>
    </RevealSection>
  );
}
