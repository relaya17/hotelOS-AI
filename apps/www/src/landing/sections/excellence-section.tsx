import { EXCELLENCE_LINKS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function ExcellenceSection() {
  return (
    <RevealSection
      id="excellence"
      className="section excellence"
      aria-labelledby="excellence-title"
    >
      <p className="eyebrow">מסמכים ומוכנות</p>
      <h2 id="excellence-title">הכול מוכן לבדיקה שלכם — בלי הבטחות ריקות</h2>
      <p className="section__lead">
        Playbook, שאלון אבטחה, נתיב SOC2 ו־unit economics — פתוחים לעיון.
        מה שדורש חתימה חיצונית מופיע כצ׳קליסט, לא כתעודה.
      </p>
      <ul className="excellence-links">
        {EXCELLENCE_LINKS.map((link) => (
          <li key={link.id}>
            <a href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </RevealSection>
  );
}
