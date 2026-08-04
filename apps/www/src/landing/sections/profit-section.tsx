import { MODULAR_PATHS, PROFIT_LEVERS } from "../../content.js";
import { RevealSection } from "../reveal-section.js";

export function ProfitSection() {
  return (
    <RevealSection
      id="profit"
      className="section profit"
      aria-labelledby="profit-title"
    >
      <p className="eyebrow">רווחיות · מודולריות</p>
      <h2 id="profit-title">
        תראו תוצאה על חלק מהמערכת — בלי לקנות הכול מראש
      </h2>
      <p className="section__lead">
        מתחילים מ־wedge, מודדים baseline, ורואים חיסכון בזמן ובסיכון מול
        מחיר USD שקוף. רק אז מרחיבים דומיינים — מעל ה־PMS שכבר רץ אצלכם.
      </p>

      <h3 className="profit__sub">איך תדעו שזה משתלם לכם</h3>
      <ul className="profit-grid">
        {PROFIT_LEVERS.map((lever) => (
          <li key={lever.id} className="profit-item">
            <h4>{lever.title}</h4>
            <p>{lever.body}</p>
          </li>
        ))}
      </ul>

      <h3 className="profit__sub">הכול או רק חלק — איך מתחילים אצלכם</h3>
      <ul className="modular-grid">
        {MODULAR_PATHS.map((path) => (
          <li key={path.id} className="modular-item">
            <h4>{path.title}</h4>
            <p>{path.body}</p>
          </li>
        ))}
      </ul>

      <p className="section__note">
        המסלול שלכם: Pilot $5,000 → מדידה ב־scorecard → Network $1,000 /
        מלון / חודש רק על מה שרץ.{" "}
        <a href="#packages">חבילות</a>
        {" · "}
        <a href="#how-pilot">פיילוט 4 שבועות</a>
        {" · "}
        <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/planning/pilot-roi-scorecard.md">
          Scorecard
        </a>
        .
      </p>
    </RevealSection>
  );
}
